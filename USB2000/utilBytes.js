
class utilBytes{
	zeroFill =(number,width)=>{
		width -= number.toString().length;
		if (width > 0) {
			return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
		}
		return number + ""; // always return a string
	}

	toBinary = (value) =>{
		let number = value.toString(2)
		return number+'';
	}

	toHex = (value) =>{
		value = parseInt(value,2);
		let hex = value.toString(16);
		return '0x'+hex+'';
	}

	hex16BitToDecimal = (data) =>{

		if(data.length<2) return false

		let lsb = this.zeroFill(data[1].toString(2), 8);
		let msb = this.zeroFill(data[0].toString(2), 8);
		
		let pixel = this.zeroFill((msb + lsb), 16);
		let convertedValue = parseInt(pixel,2);
		return convertedValue
	}
}

module.exports = utilBytes;