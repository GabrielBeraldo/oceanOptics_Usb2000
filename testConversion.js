const plotlib = require('nodeplotlib');

const KalmanFilter = require('kalmanjs');
const kf = new KalmanFilter({R: 0.1, Q: 1})

const ub = require('./USB2000/utilBytes'),
    utilBytes = new ub();

const testData = require(`./testData.json`);
//const data = JSON.parse(testData);

//console.log(testData.values);

let plotData = [
    {   
        name:"unfiltered",
        y:[],
        type:"line"
    },
    {   
        name:"filterd",
        y:[],
        type:"line"
    }
]


const filterSpectrumData = (data) =>{
    let filtered = [];
    data.map((pixel)=>{
        filtered.push(kf.filter(pixel));
    });
    return filtered;
}

const convertDataTest = (data) =>{
    if(data.length == 1) return
    let convertedData = [];
    let offset = 64;

    for(let i=0; i< data.length; i+=(offset*2)){
        for(let j=0; j<offset; j++){
            
            let index = i+j;
            
            let lsb = data[index];
            let msb = data[offset+index];

            let pixel = utilBytes.hex16BitToDecimal([msb,lsb]);
            //console.log(index.toString() + ": ", pixel);
            //console.log("lsb:" + lsb.toString() + " msb:" + msb.toString());
            convertedData.push(pixel);
        }
        //console.log("================end of semi block================");
    }
    //console.log("//////////////////////end of data block//////////////////////");

    return convertedData;
}

let spectrumSim = [];
for(data of testData.segmentedValues){
    let values = convertDataTest(data);
    spectrumSim = spectrumSim.concat(values);
}

plotData[0].y=spectrumSim;
plotData[1].y=filterSpectrumData(spectrumSim);

plotlib.plot(plotData);
