

var ub = require('./utilBytes'),
    utilBytes = new ub();
var us = require('underscore');

class spectrumData{
    constructor(options, callback){
        //class basic data
        this.defaultOptions={
            spectrumFrames:9,
            errorTimeout:10000,
        };
        this.options = us.defaults(options || {}, this.defaultOptions);
        this.callback = callback ? callback : () => {};

        //spectrum specific values
        this.dataCounter = 0;
        this.spectrum = [];

        //error timeout
        this.timeout = false;

        this.trigCallback = null;

        //byte utilities
        //this.utilBytes = new utilBytes();
    }

    newSpectrumRequest = (callback) =>{
        this.spectrum = [];
        this.dataCounter = 0;

        this.callback = callback ? callback : (data, error)=>{ 
            if(error){
                console.error(error);
            }else console.log(data);
        };

        //error timeout
        this.timeout = setTimeout(()=>{
            let error = "Timeout on request " + this.options.errorTimeout + "ms"
            this.callback(null, error),
            this.callback = () => {};
        }, this.options.errorTimeout);

    }

    processData = (data) =>{
        this.dataCounter++
        if(this.dataCounter >= this.options.spectrumFrames || data.length <=1){
            //ok received the expected number of packets, clear the timeout and return processed data 
            clearTimeout(this.timeout);
            this.callback(this.spectrum, null);
            if(this.trigCallback) this.trigCallback();

        } else {
            let values = this.convertData(data);
            this.spectrum = this.spectrum.concat(values);
        }
    }

    convertData = (data) =>{
        if(data.length == 1) return;
        let convertedData = [];
        let offset = 64;

        for(let i=0; i< data.length; i+=(offset*2)){
            for(let j=0; j<offset; j++){
                
                let index = i+j;
                
                let lsb = data[index];
                let msb = data[offset+index];

                let pixel = utilBytes.hex16BitToDecimal([msb,lsb]);
                convertedData.push(pixel);
            }
        }
        return convertedData;
    }


    get data(){
        return this.spectrum;
    } 

    set triggerCallback(cb){
        this.trigCallback = cb;
    }
}

module.exports = spectrumData;