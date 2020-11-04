const oceanOpticsUSB2000 = require('./USB2000/USB2000.js');
const us = require('underscore');
const ub = require('./USB2000/utilBytes'),
    utilBytes = new ub();

const {KalmanFilter} = require('kalman-filter'),
    kFilter = new KalmanFilter();

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

const handleSpectrumData = (data, error) =>{
    if(error){
        console.log("spectrum error: ", error);
        return
    }
    console.log("unfiltered data:", data);
    let filtered = kFilter.filterAll(data);
    console.log("filtered data:", filtered);
}

if(oceanOptics.isOperational){
    oceanOptics.requestSerialNumber((data, error)=>{
        deviceData.sn=data.toString();
        console.log(deviceData);
    });
    
    oceanOptics.queryStatus((data)=>{
        deviceData = us.defaults(data, deviceData);
        console.log(deviceData);
    });

    //strobe on
    oceanOptics.setStrobeEnableStatus(true, (status)=>{
        let message = status ? "transmission success" : "transmission failed";
        //console.log(message);
    });

    oceanOptics.setIntegrationTime(100);

    //get spectrum
    for(let i = 1; i<=1; i++){
        
        oceanOptics.requestSpectrum((data,error)=>handleSpectrumData(data, error));

    }

    oceanOptics.queryStatus((data)=>{
        console.log('status data: ', data);
    });
    
    oceanOptics.setStrobeEnableStatus(false);
}

console.log("deviceData", deviceData);
console.log("spectrumData", spectrumData);

