
export class DefaultColorPicker {
    appId = 'edit.defaults.colors'

    #enabled = false
	#palette = ["#F8EDE3","#DFD3C3", "#D0B8A8", "#7D6E83", "#6F38C5", "#87A2FB", "#ADDDD0", "#EEEEEE"]

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

	brightness(color) {
		let avg = 0.0
		for (let i = 0; i < 3; ++i) {
			avg += color[i];
		}
		avg /= 3
		return avg / 128;
	}

	textColor(container) {
		let color = this.getNodeColor(container)
		let brightness = this.brightness(color)

		if (brightness > 0.5) {
			return this.colorToCssColor([0,0,0])
		} else {
			return this.colorToCssColor([255, 255, 255])
		}
	}

    overlayWith(containers) {
		for (const container of containers) {
			let color = this.getNodeColor(container);
			let i = (this.findClosestPaletteColor(color) + 1) % this.#palette.length;
			return this.colorToCssColor(this.convertColor(this.#palette[i]));
		}
        return this.#getRandomColor();
    }

    softOverlayWith(containers) {
		for (const container of containers) {
			return this.this.colorToCssColor(this.invertColor(this.getNodeColor(container)));
		}
        return this.#getRandomColor();
    }

	getNodeColor(node, upperLayerColour) {
		node = this.container.lookup(node);
		let style = this.container.getComputedStyle(node, ["background-color"]);
		let color = this.convertColor(style["background-color"]);
		if (node != document.documentElement && this.isCompletelyTransparent(color)) {
			return this.getNodeColor(node.parentNode, color)
		}
		return color
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
			color=color.substring(color.indexOf('(')+1, color.indexOf(')'));
			rgbColors=color.split(',');
			for(var i in rgbColors) {
				rgbColors[i] = parseInt(rgbColors[i]);
			}	
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
			rgbColors[3]=0; //ToDo parse alpha if present
		}
		return rgbColors;
	}
	
	alphaBlendColors(left, right) {
		//Naive implementation
	}

	isCompletelyTransparent(color) {
		return color.length > 3 && color[3] == 0
	}

	colorDistance(left, right) {
		let dist = 0
		for (let i = 0; i < 3; ++i) {
			dist += Math.abs(left[i] - right[i])
		}
		return dist
	}

	equals(left, right) {
		for (let i = 0; i < 3; ++i) {
			if(left[i] != right[i]) {
				return false;
			}
		}
		return true;
	}

	findClosestPaletteColor(color) {
		let minDist = null;
		let findex = 0;
		for (let i = 0 ; i < this.#palette.length; ++i) {
			let hexPcolor = this.#palette[i]

			let pcolor = this.convertColor(hexPcolor)
			let distance = this.colorDistance(color, pcolor)
			if (minDist == null || distance < minDist) {
				findex = i;
				minDist = distance;
			}
		}

		return findex;
	}
}