var ub = require('./utilBytes'),
    utilBytes = new ub();

class usb2000Commands{
    
    constructor(){
        this.config_regs = {
            0: 'serial_number',
            1: '0_order_wavelength_coeff',
            2: '1_order_wavelength_coeff',
            3: '2_order_wavelength_coeff',
            4: '3_order_wavelength_coeff',
            5: 'stray_light_constant',
            6: '0_order_nonlinear_coeff',
            7: '1_order_nonlinear_coeff',
            8: '2_order_nonlinear_coeff',
            9: '3_order_nonlinear_coeff',
            10: '4_order_nonlinear_coeff',
            11: '5_order_nonlinear_coeff',
            12: '6_order_nonlinear_coeff',
            13: '7_order_nonlinear_coeff',
            14: 'polynomial_order',
            15: 'bench_configuration',
            16: 'USB4000_config',
            17: 'autonull',
            18: 'baud_rate' 
        }   
        
        this.commands={
            initialize:this.returnCommand("initialize", 0x01, false),
            setIntegrationTime:this.returnCommand("setIntegrationTime", 0x02, false),
            setStrobeEnableStatus:this.returnCommand("setStrobeEnableStatus", 0x03, false),
            queryInformation:this.returnCommand("queryInformation", 0x05, true),
            writeToEEPROM:this.returnCommand('writeToEEPROM', 0x06, false),
            writeSerialNumber:this.returnCommand('writeSerialNumber', 0x07, false),
            getSerialnumber:this.returnCommand('getSerialNumber', 0x08, true),
            requestSpectrum:this.returnCommand('requestSpectrum', 0x09, false),
            setTriggerMode:this.returnCommand('setTriggerMode',0x0A, true),
            queryPlugind:this.returnCommand('queryPlugins',0x0B,true),
            pluginsId:this.returnCommand('pluginsId',0x0C,true),
            detectPlugins:this.returnCommand('detectPlugins', 0x0D, true),
            queryStatus:this.returnCommand('queryStatus', 0xFE, true)

        }

        this.dataHandler={
            getSerialNumber(data){
                let value = data.toString('ascii');
                return value
            },
            queryInformation(data){
                return data
            },
            queryStatus(bytes){
                let response={
                    pixelsN:0,
                    integrationTime:0,
                    strobeState:0,
                    triggerMode:0,
                    requestSpectrum:0,
                    timerSwap:0,
                    spectrumReady:0
                };

                response.pixelsN= utilBytes.hex16BitToDecimal([bytes[1], bytes[0]]);
                response.integrationTime = utilBytes.hex16BitToDecimal([bytes[2], bytes[3]]);
                response.strobeState = parseInt(bytes[4],2);
                response.triggerMode = parseInt(bytes[5],2);
                response.requestSpectrum = parseInt(bytes[6],2);
                response.timerSwap = parseInt(bytes[7],2);
                response.spectrumReady = parseInt(bytes[8],2);

                return response
            }
        }
    }

    returnCommand(name, add, responds){
        return{
            name:name,
            address: add,
            responds:responds
        }
    }

    get=(name)=>{
        if(this.commands.hasOwnProperty(name)){
            return this.commands[name];
        }else return false
    }

    dataHandlers=(name)=>{
        if(this.dataHandler.hasOwnProperty(name)){
            return this.dataHandler[name];
        }else return false
    }
}
module.exports = usb2000Commands;