

const plotlib = require('nodeplotlib');
const us = require('underscore');

const cs = require('./cubicSolver'),
      cubicSolver = new cs();

const testData = require(`./testData.json`);


//filters
const KalmanFilter = require('kalmanjs'),
      kf = new KalmanFilter({R: 4, Q: 6});
const movingAverage = require('moving-averages');

const lowPassFilter = require('./lowPassFilter');

const acquisitionsToAverage = 10;
const errorAmplification = 20;

const filterType = 'kalman'; //`moving-average`;

//ocean optics and device info
const oceanOpticsUSB2000 = require('./USB2000/USB2000.js');
const { max } = require('underscore');
const oceanOptics = new oceanOpticsUSB2000({
    errorTimeout:5000,
    logRawTransmittedData:false
});

let deviceData = {}
let spectrumData = {
    counter:0,
    accumulative:[],
    dark:testData.dark,
    baseline:testData.baseline,
    T:[],
    ABS:[]
};
let waveLength =  {
    min:0,
    max:0,
    requested:459.9,
    relatedPixel:0
}


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
    },
    {   
        name:"Error",
        y:[],
        type:"line"
    },
    {   
        name:"Abs error",
        y:[],
        type:"line"
    }

]

//------------------------------------------------------------------
// functions
//------------------------------------------------------------------
const triggerSolveCubic = () =>{
    const f = (i) => (a0+(a1*i)+(a2*(i**2))+(a3*(i**3)));
    
    let a0 = deviceData['0_order_wavelength_coeff'],
        a1 = deviceData['1_order_wavelength_coeff'],
        a2 = deviceData['2_order_wavelength_coeff'],
        a3 = deviceData['3_order_wavelength_coeff'] 

    let a=a3, b=a2, c=a1, d=(a0-waveLength.requested);

    let roots = cubicSolver.solve(a,b,c,d);

    
    let pixel = roots.filter((root)=>{
        if(root >= 0 && root <= 2048) return root
    })
    
    waveLength.relatedPixel = pixel[0];
    waveLength.min = a0;
    waveLength.max = f(2048);
    
    console.log("wl range, from: " + waveLength.min.toString() + " to: " + waveLength.max.toString() );
    console.log("roots: ", roots);
    console.log("pixel address:", waveLength.relatedPixel);
    
}

const filterSpectrumData = (unfilteredData) =>{
    
    unfilteredData = lowPassFilter(unfilteredData, 0.3, 1, 1);
    
    let filtered = [...unfilteredData];
    
    if(filterType === 'kalman'){
        //filtered = unfilteredData.map((pixel)=>{return kf.filter(pixel)});
    }else{
        //filtered = movingAverage.sma(unfilteredData, 1.5);
    }
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

    plotData[0].y=[...data];

    let filtered = filterSpectrumData(data);
    plotData[1].y=filtered;

    calculateSpectrumMeasurements(data);
    plotData[2].y=spectrumData.T;
    plotData[3].y=spectrumData.ABS;

    plotData[4].y=data.map((value,index)=>{return(filtered[index]/plotData[0].y[index])});
    plotData[5].y=data.map((value,index)=>{return(Math.abs(filtered[index]-plotData[0].y[index]))*errorAmplification});


    //console.dir(plotData[0].y, {'maxArrayLength': null});
    
    getAbsOnWl();//
    
    plotlib.stack([plotData[0], plotData[1], plotData[5]]);
    plotlib.stack([plotData[4]]);
    plotlib.stack([plotData[2]]);
    plotlib.stack([plotData[3]]);
    plotlib.plot();
    
}

const spectrumCallback = (data, error) =>{
    if(error) return

    for(let index=0; index<= data.length; index++){
        if(spectrumData.counter===0){
            spectrumData.accumulative[index]=data[index];
        }else spectrumData.accumulative[index]+=data[index];

    }

    spectrumData.counter++;
    if(spectrumData.counter >= acquisitionsToAverage){
        let averageData = [];
        for(let index=0; index<= spectrumData.accumulative.length; index++){
            averageData[index] = (spectrumData.accumulative[index]/spectrumData.counter);
        }

        spectrumData.counter=0;
        spectrumData.accumulative=[];

        //console.log("calculated average of spectrum");
        handleSpectrumData(averageData, error);
    }

    //console.log("added to accumulative spectrum data");
}

const getAbsOnWl = () =>{
    let lowerPixel = Math.floor(waveLength.relatedPixel);
    let fractionalUpperValue = waveLength.relatedPixel-lowerPixel;
    let fractionalLowerValue = 1-fractionalUpperValue;


    let value = (spectrumData.ABS[lowerPixel]*fractionalLowerValue)+(spectrumData.ABS[lowerPixel+1]*fractionalUpperValue);
    
    console.log("lowerPixel:", lowerPixel);
    console.log("lower:", fractionalLowerValue);
    console.log("upper:", fractionalUpperValue);
    console.log("abs on wl:", value);

}

const run = ()=>{
        
    if(oceanOptics.isOperational){

        oceanOptics.queryStatus((data)=>{
            deviceData = us.defaults(data, deviceData);
            deviceData = us.defaults(oceanOptics.deviceConfiguration, deviceData);

            console.log(deviceData);
            triggerSolveCubic();
        });

        oceanOptics.setStrobeEnableStatus(true);
        oceanOptics.setIntegrationTime(100);

        //get spectrum
        setTimeout(()=>{
            for(let i=0; i<=acquisitionsToAverage; i++){
                oceanOptics.requestSpectrum((data,error)=>spectrumCallback(data, error));
            }
            
            oceanOptics.setStrobeEnableStatus(false);
        }, 1000);
    }
}

//------------------------------------------------------------------
// execution itself
//------------------------------------------------------------------
run();

//console.log("deviceData", deviceData);
//console.log("spectrumData", spectrumData);

