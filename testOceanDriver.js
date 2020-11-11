
const plotlib = require('nodeplotlib');
const oceanOpticsUSB2000 = require('./USB2000/USB2000.js');
const us = require('underscore');
const regression = require('regression');

const KalmanFilter = require('kalmanjs');
const kf = new KalmanFilter({R: 1, Q: 5})

const oceanOptics = new oceanOpticsUSB2000({
    errorTimeout:5000,
    logRawTransmittedData:false
});

const testData = require(`./testData.json`);

let deviceData = {
    sn:''
}
let spectrumData = {
    dark:testData.dark,
    baseline:testData.baseline,
    T:[],
    ABS:[]
};


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
    },
    {   
        name:"T",
        y:[],
        type:"line"
    },
    {   
        name:"ABS",
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

const calculateSpectrumMeasurements = (data) =>{
    data.map((pixel, index)=>{
        //if(index<64) return
        let D = spectrumData.dark[index];
        let R = spectrumData.baseline[index];

        let T = ((pixel-D)/(R-D))*100;
        let ABS = -Math.log10((pixel-D)/(R-D));

        spectrumData.T[index] = T;
        spectrumData.ABS[index] = ABS;
    })
}

const handleSpectrumData = (data, error) =>{
    if(error){
        console.log("spectrum error: ", error);
        return
    }

    let filtered = filterSpectrumData(data);
    calculateSpectrumMeasurements(filtered);
    
    plotData[0].y=data;
    plotData[1].y=filtered;
    plotData[2].y=spectrumData.T;
    plotData[3].y=spectrumData.ABS;

    //console.dir(plotData[0].y, {'maxArrayLength': null});
    
    /*
    plotlib.stack([plotData[0], plotData[1]]);
    plotlib.stack([plotData[2]]);
    plotlib.stack([plotData[3]]);
    plotlib.plot();
    */
}

if(oceanOptics.isOperational){

    oceanOptics.requestSerialNumber((data, error)=>{
        deviceData.sn=data.toString();
    });
    
    oceanOptics.queryStatus((data)=>{
        deviceData = us.defaults(data, deviceData);
    });

    oceanOptics.setStrobeEnableStatus(true);
    oceanOptics.setIntegrationTime(100);

    //get spectrum
    setTimeout(()=>{
        oceanOptics.requestSpectrum((data,error)=>handleSpectrumData(data, error));
        
        oceanOptics.setStrobeEnableStatus(false);
    }, 1000);

    setTimeout(()=>{
        console.log(oceanOptics.deviceConfiguration);
    }, 2000);
}

//console.log("deviceData", deviceData);
//console.log("spectrumData", spectrumData);

