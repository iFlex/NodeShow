
export class DefaultColorPicker {
    appId = 'edit.defaults.colors'

    #enabled = false

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
		}
	}

	isEnabled() {
		return this.#enabled
	}

    #getRandomColor() {
        let R = Math.floor(Math.random() * 255);
        let G = Math.floor(Math.random() * 255);
        let B = Math.floor(Math.random() * 255);

        return `rgb(${R}, ${G}, ${B})`
    }

    overlayWith(containers) {
		for (const container of containers) {
			return this.colorToCssColor(this.invertColor(this.getNodeColor(container)));
		}
        return this.#getRandomColor();
    }

    softOverlayWith(containers) {
		for (const container of containers) {
			return this.this.colorToCssColor(this.invertColor(this.getNodeColor(container)));
		}
        return this.#getRandomColor();
    }

	getNodeColor(node) {
		node = this.container.lookup(node);
		let style = this.container.getComputedStyle(node, ["background-color"]);
		return this.convertColor(style["background-color"])
	}

	colorToCssColor(color) {
		return `rgb(${color[0]},${color[1]},${color[2]})`
	}

	invertColor(color) {
		var rgbColors=new Object();
		rgbColors[0] = 255 - color[0];
		rgbColors[1] = 255 - color[1];
		rgbColors[2] = 255 - color[2];
		return rgbColors;
	}

	//Stolen from the internet...
	convertColor(color) {  
		var rgbColors=new Object();

		///////////////////////////////////
		// Handle rgb(redValue, greenValue, blueValue) format
		//////////////////////////////////
		if (color[0]=='r')
		{
			// Find the index of the redValue.  Using subscring function to 
			// get rid off "rgb(" and ")" part.  
			// The indexOf function returns the index of the "(" and ")" which we 
			// then use to get inner content.  
			color=color.substring(color.indexOf('(')+1, color.indexOf(')'));
		
			// Notice here that we don't know how many digits are in each value,
			// but we know that every value is separated by a comma.
			// So split the three values using comma as the separator.
			// The split function returns an object.
			rgbColors=color.split(',', 3);

			// Convert redValue to integer
			rgbColors[0]=parseInt(rgbColors[0]);
			// Convert greenValue to integer
			rgbColors[1]=parseInt(rgbColors[1]);
			// Convert blueValue to integer
			rgbColors[2]=parseInt(rgbColors[2]);		
		}

		////////////////////////////////
		// Handle the #RRGGBB' format
		////////////////////////////////
		else if (color.substring(0,1)=="#")
		{
			// This is simples because we know that every values is two 
			// hexadecimal digits.
			rgbColors[0]=color.substring(1, 3);  // redValue
			rgbColors[1]=color.substring(3, 5);  // greenValue
			rgbColors[2]=color.substring(5, 7);  // blueValue

			// We need to convert the value into integers, 
			//   but the value is in hex (base 16)!
			// Fortunately, the parseInt function takes a second parameter 
			// signifying the base we're converting from.  
			rgbColors[0]=parseInt(rgbColors[0], 16);
			rgbColors[1]=parseInt(rgbColors[1], 16);
			rgbColors[2]=parseInt(rgbColors[2], 16);
			}
		return rgbColors;
	}
}