/**
 * EP2Out = 0x02
 * EP2In = 0x82
 * EP7In = 0x87
 * EP7Out = 0x07
 */

var us = require('underscore');
var usb = require("usb");
var spectrumHandler = require('./spectrumData');
var usb2000commands = require('./usb2000Commands'),
    commands = new usb2000commands();
var ub = require('./utilBytes'),
    utilBytes = new ub();


class USB2000{
    constructor(options){
        this.defaultOptions = {
            VID: 0x2457,
            PID: 0x1002,
            integrationTime: 100,
            strobeEnableStatus: 0,
            triggerMode: 0,
            spectrumFrames:9,
            errorTimeout:10000,
            logRawTransmittedData:false
        }
        this.control={
            busy:false,
            claimed:false,
            deviceIsOpen:false,
            deviceFound:false,
            waitingSpectrum:false
        }
        this.device = false;

        this.queue={
            callback:[],
            dataHandler:[],
            command:[]
        }

        this.deviceConfigurationData={

        }

        //set options 
        this.options = us.defaults(options || {}, this.defaultOptions);
        //console.log(this.options);
        
        //initialize 
        if(this.initialize()){
            this.configEndpoints();
            this.usbClaim();
            this.queryInformation();
        } 

        //this.utilBytes = new utilBytes();
        this.spectrumData = new spectrumHandler({
            spectrumFrames: this.options.spectrumFrames,
            errorTimeout: this.options.errorTimeout
        });
        this.spectrumData.triggerCallback = ()=>{
            this.triggerSpectrumRead();
        }
    }

    /**
	 * initialize routine
	 */
    initialize = () =>{
        
        //search for a device
        this.device = usb.findByIds(this.options.VID, this.options.PID);
        //console.log(this.device);

        if(!this.device){
            console.error("USB200 DEVICE NOT FOUND!");
            return false
        }
        this.control.deviceFound = true;
        
        try{
            this.device.open();

        }catch(e){
            if(e){
                console.error(e);
                return false
            }
        }

        this.deviceIsOpen = true;

        this.iface = this.device.interfaces[0];

        return true;
    }

    /**
	 * configure and setup the endpoints
	 */
    configEndpoints = () =>{
		var iface = this.iface

		this.EP7In = iface.endpoint(0x87)
		this.EP2Out = iface.endpoint(0x02)
		this.EP2In = iface.endpoint(0x82)

		//spectro data
		this.EP2In.on("data", (buf) => {this.spectrumData.processData(buf)});

		//all others data
		this.EP7In.on("data", (data) => {this.handleReceivedData(data)});
    }

    /**
	 * Claim for device and start the stream of endpoints
	 */
	usbClaim = () => {
		if(this.control.claimed) return

		var iface = this.iface
		//if(iface.isKernelDriverActive()) iface.detachKernelDriver();
		iface.claim()

		this.EP7In.startPoll(1, 512)
		this.EP2In.startPoll(1, 512)

		this.control.claimed = true
	}

    handleReceivedData = (data) =>{
        //console.log(data)
        this.control.busy = false;
        
        //recover the data handler and callbackfunction
        let dataHandler = this.queue.dataHandler.shift();
        let callback = this.queue.callback.shift();

        let processedData = dataHandler ? dataHandler(data) : data;

        if(callback) callback(processedData, null);

        this.control.busy = false;
        this.triggerCommandQueue();
    }

    triggerCommandQueue = () =>{
        if(this.queue.command.length <= 0) return;
        let commandSet = this.queue.command.shift();
        //console.log(this.queue.command);
        //console.log("commandSet:", commandSet);
        this.processCommand(commandSet.cmd, commandSet.additionalData, commandSet.callback);
    }

    triggerSpectrumRead = () =>{
        this.control.waitingSpectrum = false;
        this.control.busy = false;
        this.triggerCommandQueue();
    }

     
    //------------------------------------------------------------------
    // transmit functions
    //------------------------------------------------------------------
    
    processCommand = (cmd, additionalData=undefined, callback=null) => {
        //console.log(cmd);
        let data=cmd.address;
        let immediateCallback = false;

        //check if its available to receive commands if not add to queue
        if(this.control.busy){
            //console.log('pushing to queue:', cmd);
			this.queue.command.push({
                cmd:cmd,
                additionalData:additionalData,
                callback:callback
            });
            return false
		}

        let buffer = [data];
        if(additionalData !== undefined && additionalData !== null) {
            if(additionalData.length > 1){
                additionalData.forEach((val)=>{
                    buffer.push(val);
                });
            }else buffer.push(additionalData);
		}

        if(cmd.name ==='requestSpectrum'){
            if(this.control.waitingSpectrum) return;

            this.spectrumData.newSpectrumRequest(callback);
            callback = null;
            this.control.waitingSpectrum = true;
        }
		if(callback !== null && typeof(callback) === 'function'){
            if(cmd.responds){
                this.queue.callback.push(callback);
                this.queue.dataHandler.push(commands.dataHandlers(cmd.name));
            }else immediateCallback = true;
        }

        //transfer to usb specific endpoint and set state as busy
        this.control.busy= true;
        let transmitted = this.transmitRawToUsb(buffer);
        
        //calback with true or false depending of the transmission success
        if(transmitted && immediateCallback) callback(transmitted,null);
        
        //trigger again if the current command send wont respond
        if(!cmd.responds && !this.control.waitingSpectrum){
            this.control.busy = false;
            this.triggerCommandQueue();
        }

        return transmitted;
	}

    /**
	 * transmit raw hex to specific endpoint
	 */
    transmitRawToUsb = (bytes) =>{
        if(!this.control.claimed) return false;

        let buf = Buffer.from(bytes); 
        //debug buffer
        if(this.options.logRawTransmittedData)console.log("Buffer: ",buf);
        
        while (bytes.length > 0) {
            buf.writeUInt8(bytes.pop(),bytes.length);
        }
        
        //transter
        this.EP2Out.transfer(buf);

        return true
    }

    //------------------------------------------------------------------
    // command functions
    //------------------------------------------------------------------

    initializeUSB2000 = (callback=null) =>{
        let cmd = commands.get('initialize');
        this.processCommand(cmd, callback);
    }
    
    setStrobeEnableStatus = (state=false, callback=null) =>{
        let cmd = commands.get('setStrobeEnableStatus');
        let stateData = state ? 0x01 : 0x00;

        this.processCommand(cmd, stateData, callback);
    }

    requestSpectrum = (callback=null) => {
        //this.spectrumData.newSpectrumRequest(callback);
        let cmd=commands.get('requestSpectrum');

        this.processCommand(cmd, null, callback)
    }

    requestSerialNumber = (callback=null) =>{
        let cmd = commands.get('getSerialnumber');
        this.processCommand(cmd, null, callback);
    }

    setIntegrationTime = (time=this.options.integrationTime, callback=null) =>{

        //16-bit timer -> Integration range is 3 to 65535 ms
        //time is given in microseconds
        //3s = 3000ms
        //3000ms = 0000101110111000 
        //MSW = 00001011 LSW=10111000 
        let cmd = commands.get('setIntegrationTime');
        let bin = utilBytes.toBinary(time); 
        bin = utilBytes.zeroFill(bin, 16); //fill the zeros to complete all the 16 bits

        //break into most/least significant word
        let msb = bin.substring(0, 8);
        let lsb = bin.substring(8, 16);

        msb = utilBytes.toHex(msb);
        lsb = utilBytes.toHex(lsb);

        //data must be organized as:
        //byte 1 = LSB, byte 2 = MSB;
        let data=[lsb, msb];
        this.processCommand(cmd, data, callback);
    }

    queryStatus = (callback=null) =>{
        let cmd = commands.get('queryStatus');
        this.processCommand(cmd,null,callback);
    }

    queryInformation = () =>{
        let cmd = commands.get('queryInformation');
        let infoBytes = commands.informationBytes;

        for(let data in infoBytes){
            this.processCommand(cmd, infoBytes[data], (d)=>{
                //store the returned data to device configuration object 
                this.deviceConfigurationData[data] = d;
            })
        }
    }
    //------------------------------------------------------------------
    // getters and setters
    //------------------------------------------------------------------

    get isOperational(){
        return this.control.claimed
    }

    get spectrumArray(){
        return this.spectrumData.data
    }

    get deviceConfiguration(){
        return this.deviceConfigurationData
    }
    //------------------------------------------------------------------
    // temp test functions
    //------------------------------------------------------------------

}

module.exports=USB2000;