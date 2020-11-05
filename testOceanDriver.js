
const plotlib = require('nodeplotlib');
const oceanOpticsUSB2000 = require('./USB2000/USB2000.js');
const us = require('underscore');
const ub = require('./USB2000/utilBytes'),
    utilBytes = new ub();

const KalmanFilter = require('kalmanjs');
const kf = new KalmanFilter()

const oceanOptics = new oceanOpticsUSB2000({
    errorTimeout:5000,
    logRawTransmittedData:false
});

let deviceData = {
    sn:''
}
let spectrumData = {
    dark:[],
    reference:[],
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
    }
]

const filterSpectrumData = (data) =>{
    let filtered = [];
    data.map((pixel)=>{
        filtered.push(kf.filter(pixel));
    });
    return filtered;
}

const handleSpectrumData = (data, error) =>{
    if(error){
        console.log("spectrum error: ", error);
        return
    }

    plotData[0].y=data;
    plotData[1].y=filterSpectrumData(data);

    //console.log("unfiltered data:", plotData[0].y);

    console.dir(plotData[0].y, {'maxArrayLength': null});
    //console.log("filtered data:", plotData[1].y);

    //plotlib.plot(plotData);
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
}

console.log("deviceData", deviceData);
console.log("spectrumData", spectrumData);

