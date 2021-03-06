export class Cursor {
	
	#editor = null;
	#target = null
	#lineNumber = 0;
	#charNumber = 0;
	#localCharNumber = 0;

	constructor (textEditor, target) {
		this.#target = target
		this.#editor = textEditor
	}

	#getLineAt(lineNumbe) {
		lineNumbe = this.#capLineNumber(lineNumbe)
		return this.#editor.getLine(this.#target, lineNumbe)
	}

	#getLineWidth(line) {
		let result = 0;
		if (line.childNodes){
			for (const unit of line.childNodes) {
				result += unit.innerHTML.length
			}
		}
		return result
	}

	#biasToEmptyUnit(unit) {
		if (!unit || unit.innerHTML.length == 0) {
			return unit
		}
		if (this.#localCharNumber == 0 && unit.previousSibling) {
			this.#localCharNumber = unit.previousSibling.innerHTML.length
			return unit.previousSibling
		}
		if (this.#localCharNumber > 0 && this.#localCharNumber == unit.innerHTML.length) {
			if (unit.nextSibling && unit.nextSibling.innerHTML.length == 0) {
				return unit.nextSibling
			}
		}
		return unit
	}

	#getCurrentTextUnit(line) {
		if (!line) {
			this.#localCharNumber = 0;
			this.#charNumber = 0;
			return null;
		}

		if (!line.childNodes) {
			this.#charNumber = 0;
			this.#localCharNumber = 0;
			return null;
		}
		
		if (this.#charNumber < 0) {
			this.#charNumber = 0;
			this.#localCharNumber = 0;
			return line.childNodes[0]
		}

		let index = 0;
		let lastUnit = null;
		for (const unit of line.childNodes) {
			let unitLen = unit.innerHTML.length 
			index += unitLen
			if ( index > this.#charNumber ) {
				index -= unitLen
				this.#localCharNumber = this.#charNumber - index
				return this.#biasToEmptyUnit(unit)
			}
			lastUnit = unit
		}

		//must cap
		this.#charNumber = index
		if (lastUnit) {
			this.#localCharNumber = lastUnit.innerHTML.length	
		} else {
			this.#localCharNumber = 0;
		}
		return this.#biasToEmptyUnit(lastUnit)
	}

	#capLineNumber(number) {
		if (number < 0) {
			return 0;
		}

		let lines = this.#editor.getLinesCount(this.#target);
		if (lines > 0 && number >= lines) {
			return lines - 1;
		}
		return number
	}

	#getCurrentLine () {
		this.#lineNumber = this.#capLineNumber(this.#lineNumber)
		if (this.#editor.getLinesCount(this.#target) == 0) {
			return null
		}
		return this.#editor.getLine(this.#target, this.#lineNumber)
	}

	#getSign(val) {
		if (val < 0) {
			return -1
		}
		return 1
	}

	setTarget (target) {
		this.#target = target
	}

	get () {
		let line = this.#getCurrentLine()
		return {
			line:line, 
			textUnit:this.#getCurrentTextUnit(line), 
			lineNumber: this.#lineNumber, 
			charNumber: this.#charNumber,
			localCharNumber: this.#localCharNumber
		}
	}

	getPosition() {
		return {
			lineNumber: this.#lineNumber, 
			charNumber: this.#charNumber
		}
	}

	putAt (lineNo, charNo) {
		this.#lineNumber = lineNo
		this.#charNumber = charNo

		let line = this.#getCurrentLine()
		let textUnit = this.#getCurrentTextUnit(line)
		
		return {
			line: line,
			textUnit: textUnit,
			lineNumber: this.#lineNumber,
			charNumber: this.#charNumber
		}
	}

	putOn (unit, offset=0) {
		//cap the offset
		if (offset < 0) {
			offset = 0;
		}

		if (offset > unit.innerHTML.length) {
			offset = unit.innerHTML.length - 1;
		}

		this.#localCharNumber = offset
		this.#charNumber = offset
		
		let pointer = unit.previousSibling;
		while(pointer) {
			this.#charNumber += pointer.innerHTML.length
			pointer = pointer.previousSibling
		}

		this.#lineNumber = 0;
		let linePointer = unit.parentNode.previousSibling
		while(linePointer) {
			this.#lineNumber++;
			linePointer = linePointer.previousSibling
		}

		return this.getPosition()
	}

	putAtLineEnd() {
		let line = this.#getCurrentLine()
		let width = this.#getLineWidth(line)
		this.#charNumber = width
		let textUnit = this.#getCurrentTextUnit(line)
		
		return {
			line: line,
			textUnit: textUnit,
			lineNumber: this.#lineNumber,
			charNumber: this.#charNumber
		}
	}	

	putAtLineStart() {
		this.#charNumber = 0

		let line = this.#getCurrentLine()
		let textUnit = this.#getCurrentTextUnit(line)		
		return {
			line: line,
			textUnit: textUnit,
			lineNumber: this.#lineNumber,
			charNumber: this.#charNumber
		}
	}

	move (amount) {
		let status = this.get()
		let newStatus = null
		
		do {
			newStatus = this.putAt(status.lineNumber, status.charNumber + amount)
			let charDelta = newStatus.charNumber - status.charNumber
			
			status = newStatus
			amount -= charDelta
			
			if (charDelta == 0 && amount != 0) {
				//seems stuck, try next line
				let sign = this.#getSign(amount)
				let nextLine = newStatus.lineNumber + sign * 1
				if (nextLine < 0 || nextLine >= this.#editor.getLinesCount(this.#target)) {
					break
				}

				if (sign > 0) {
					amount--;
					status = this.putAt(nextLine, 0)
				} else {
					amount++;
					status = this.putAt(nextLine, this.#getLineWidth(this.#getLineAt(nextLine)))
				}
			}
		} while( amount != 0 )

		let result = this.get()
		return result
	}
} 