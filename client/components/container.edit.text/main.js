class ContainerTextInjector {
	appId = "container.edit.text"

	container = null;	
	target = null;

	perms = {"container.move":{"*":false}}
	lineDescriptor = {nodeName: "DIV", className: "text-document-line", permissions:{"container.move":{"*":false}}}
	textUnitDescriptor = {nodeName: "SPAN", className: "text-document-unit", permissions:{"container.move":{"*":false}}}
	newLineDescriptor = {nodeName: "BR", className: "text-document-newline", permissions:{"container.move":{"*":false}}}
	preventDefaults = {'u':true,'b':true,'i':true,' ':true}
	state = {
		control:false,
		bold:false,
		italic:false,
		underlined: false
	}
	//ToDo:
	//fix prevent default functionality (only do it for our commands, do not prevent default stuff for copy and paste)
	//selections - reverse selection & other edge cases
	//selections - ghost selections (nothing is selected on screen but it returns some selection)
	//line breaking and combining on edit
	//span compaction (combine if style is identical)

	//cursor concept	

	//resizing by other
	//resize container when text wraps
	//wrapping

	constructor (container) {
		this.container = container;
		container.registerComponent(this);

		this.target = this.container.parent
	}
 
	enable() {
		document.addEventListener("keydown", (e) => this.handleKeydown(e))
		document.addEventListener("keyup",(e) => this.handleKeyUp(e))

	    document.addEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);

		//clipboard
		document.addEventListener('paste', (event) => this.paste(event));
		document.addEventListener('cut', (event) => this.cut(event));	
	}

	disable() {
		document.removeEventListener("keydown", (e) => this.handleKeydown(e))
		document.removeEventListener("keyup",(e) => this.handleKeyUp(e))

		document.removeEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);

		//clipboard
		document.removeEventListener('paste', (event) => this.paste(event));
		document.removeEventListener('cut', (event) => this.cut(event));
	}

	static isPrintableCharacter(key) {
		return key.length === 1;
	}

	static findFirstDivParent(elem) {
		if (!elem)
			return null;

		if (elem.nodeName == 'DIV') {
			return elem
		}

		return ContainerTextInjector.findFirstDivParent(elem.parentNode)
	}

	setTarget(id) {
		console.log(`Setting text edit target to ${id}`)
		this.target = ContainerTextInjector.findFirstDivParent(this.container.lookup(id));
		console.log(`Closest div parent:`)
		console.log(this.target)		
	}

	//doesn't support rich text yet
	paste (event) {
	    let paste = (event.clipboardData || window.clipboardData).getData('text');
	    this.addPrintable(paste)
	    event.preventDefault();
	}

	cut (event) {
		console.log("Cutting")
		this.deleteSelection();
		event.preventDefault();
	}
	
	isLine(elem) {
		return elem.className.includes(this.lineDescriptor.className); 
	}

	isTextUnit(elem) {
		return elem.className.includes(this.textUnitDescriptor.className);
	}

	isNewLine(elem) {
		return elem.nodeName == this.newLineDescriptor.nodeName;
	}

	makeNewLine() {
		return this.container.createFromSerializable(this.target.id, this.lineDescriptor)
	}

	makeNewTextChild (line) {
		return this.container.createFromSerializable(line.id, this.textUnitDescriptor)
	}

	splitTextUnit(unit, offset) {
		if (!this.isTextUnit(unit)) {
			console.log(unit)
			throw 'You can use splitTextUnit only on textUnits'
		}

		if (offset == 0) {
			return [unit.previousSibling, unit]
		}
		
		if (offset == unit.innerHTML.length) {
			return [unit, unit.nextSibling]
		}

		let rightText = unit.innerHTML.substring(offset, unit.innerHTML.length)
		unit.innerHTML = unit.innerHTML.substring(0, offset)
		
		let descriptor = this.container.toSerializable(unit.id)
		delete descriptor.id;
		descriptor.innerHTML = rightText;
		descriptor.permissions = this.perms

		let right = this.container.createFromSerializable(unit.parentNode.id, descriptor, unit.nextSibling)	
		
		return [unit, right]
	}

	getCurrentLine(makeIfNone) {
		let lastLine = null;
		for (let child of this.target.children) {
			if (this.isLine(child)) {
				lastLine = child;
			}
		}

		if(makeIfNone && !lastLine) {
			return this.makeNewLine();
		}
		return lastLine;
	}

	getCurrentTextChild(createIfNone) {
		let line = this.getCurrentLine(createIfNone);
		if (!line) {
			return {};
		}

		let lastChild = line.lastChild;
		if (createIfNone && !lastChild) {
			lastChild = this.makeNewTextChild(line);
		}
		if (createIfNone && lastChild && this.isNewLine(lastChild)) {
			line = this.makeNewLine();
			lastChild = this.makeNewTextChild(line);
		}
		return {child:lastChild, line:line}
	}

	addPrintable(text) {
		this.deleteSelection();

		let editPoint = this.getCurrentTextChild(true);
		editPoint.child.innerHTML += text;
		this.container.notifyUpdate(editPoint.child.id)
	}


	deleteSelection() {
		let selection = this.getSelected().units;
		if (selection && selection.length > 0) {
			this.deleteTextUnits(selection);
			return true;
		}
		this.clearSelection()
		return false;
	}

	deleteTextUnits(units) {
		for (const unit of units) {
			this.container.delete(unit.id)
		}
	}

	removePrintable(count) {
		if (count < 1) {
			return;
		}

		
		if (this.deleteSelection()) {
			return;
		}

		let editPoint = this.getCurrentTextChild();
		let textUnit = editPoint.child;
		let line = editPoint.line;

		if (line == null) {
			return;
		}

		if (textUnit == null){
			this.container.delete(line.id);
			this.removePrintable(count);
			return;
		}

		if (textUnit.innerHTML.length == 0){
			this.container.delete(textUnit.id);
			this.removePrintable(count - 1);
		} else {
			textUnit.innerHTML = textUnit.innerHTML.substring(0, textUnit.innerHTML.length - 1);
		}
		this.container.notifyUpdate(textUnit.id)
	}

	newLine() {
		let line = this.getCurrentLine(true);
		this.container.createFromSerializable(line.id, this.newLineDescriptor);
	}

	styleTextUnits(style, textUnits) {
		for (const unit of textUnits) {
			if (this.isTextUnit(unit)) {
				this.container.styleChild(unit, style)
			}
		}
	}

	styleLines (style, lines) {
		for (const unit of lines) {
			if (this.isLine(unit)) {
				this.container.styleChild(unit, style)
			}
		}
	}

	getAllTextUnits() {
		let result = []
		for (const line of this.target.children) {
			if (this.isLine(line)) {
				for(const unit of line.children) {
					if(this.isTextUnit(unit)) {
						result.push(unit)
					}
				}
			}
		}

		return result;
	}

	changeFontSize(delta) {
		let selection = this.getSelected().units
		if (!selection || selection.length == 0) {
			selection = this.getAllTextUnits()
		}

		let modFunc = function(e) {
			try {
				let fsize = parseInt(e,10) + delta
				return fsize+"px"
			} catch (ex){
				return e
			}
		}
		this.styleTextUnits({"font-size": modFunc}, selection)
	}

	setFontSize (fontSize) {
		let selection = this.getSelected().units
		if (!selection || selection.length == 0) {
			selection = this.getAllTextUnits()
		}
		this.styleTextUnits({"font-size": fontSize}, selection)
	}

	setFont(fontFam) {
		let selection = this.getSelected().units
		if (!selection || selection.length == 0) {
			selection = this.getAllTextUnits()
		}
		this.styleTextUnits({"font-family": fontFam}, selection);
	}

	align (alignment) {
		let selection = this.getSelected().lines
		if (!selection || selection.length == 0) {
			selection = this.target.children
		}
		this.styleLines({"text-align": alignment,  "text-justify": "inter-word"}, selection)
	}

	bold () {
		console.log("BOLD CALL");
		let toggleFunc = function(e) {
			console.log(`Toggle ${e}`)
			if (e == "bold") {
				return "normal"
			}
			return "bold"
		}

		let selection = this.getSelected().units
		if (selection && selection.length > 0) {
			this.styleTextUnits({"font-weight": toggleFunc}, selection)
		} else {
			this.state.bold = toggleFunc(this.state.bold);
		}
	}

	italic (textUnits) {
		let toggleFunc = function(e) {
			if (e == 'italic') {
				return 'normal'
			}
			return 'italic'
		}

		let selection = this.getSelected().units
		if (selection && selection.length > 0) {
			this.styleTextUnits({"font-style": toggleFunc}, selection)
		} else {
			this.state.italic = toggleFunc(this.state.italic);
		}
	}

	underlined (textUnits) {
		let toggleFunc = function(e) {
			if (e == 'underline') {
				return 'none'
			}
			return 'underline'
		}

		let selection = this.getSelected().units
		if (selection && selection.length > 0) {
			this.styleTextUnits({"text-decoration": toggleFunc}, selection)
		} else {
			this.state.underlined = toggleFunc(this.state.underlined);
		}
	}

	findBetweenTextUnits (start, end) {
		let units = {}
		let lines = {}
		var currentLine = start.parentNode
		var currentTextUnit = start
			
		while (currentLine) {
			if (!currentTextUnit) {
				currentTextUnit = currentLine.firstChild
			}

			lines[currentLine.id] = currentLine
			while (currentTextUnit) {
				if (this.isTextUnit(currentTextUnit)){
					units[currentTextUnit.id] = currentTextUnit
					if (currentTextUnit == end) {
						units[end.id] = end
						return {lines:Object.values(lines), units:Object.values(units)}
					}
				}
				currentTextUnit = currentTextUnit.nextSibling
			}

			currentLine = currentLine.nextSibling
		}
		return {lines:Object.values(lines), units:Object.values(units)}
	}

	makeSelection(start, end) {
		let range = new Range();
  		range.setStart(start.firstChild, 0);
  		range.setEnd(end.lastChild, end.lastChild.length);

  		let sel = this.clearSelection()
		sel.addRange(range)
	}

	clearSelection () {
		let sel = document.getSelection();
		sel.removeAllRanges();
		return sel;
	}
	//ToDo: create new selection to represent the split
	//This is pretty broken at the moment... (ghost selections seem to stick around)
	getSelected () {
		let docSelect = document.getSelection();
		
		console.log(docSelect)
		//figure out if selection belongs to target
		// if (docSelect 
		// 	&& docSelect.focusNode
		// 	&& docSelect.anchorNode
		// 	&& this.isTextUnit(docSelect.focusNode.parentNode) 
		// 	&& this.isTextUnit(docSelect.anchorNode.parentNode)) {
			
		// 	console.log("Accepted")

		// 	var start = docSelect.anchorNode.parentNode
		// 	var startOffset = docSelect.anchorOffset
		// 	var end = docSelect.focusNode.parentNode
		// 	var endOffset = docSelect.focusOffset

		// 	let position = start.compareDocumentPosition(end)
		// 	if (position === Node.DOCUMENT_POSITION_PRECEDING){
		// 	  var aux = start;
		// 	  start = end;
		// 	  end = start;
		// 	}
		// 	if (!position && startOffset > endOffset) {
		// 	  var aux = startOffset;
		// 	  startOffset = endOffset;
		// 	  endOffset = startOffset;
		// 	}

		// 	console.log(start)
		// 	console.log(end)

		// 	let startNode = this.splitTextUnit(start, startOffset)[1]
		// 	if (start == end) {
		// 	 	endOffset -= startOffset
		// 		end = startNode
		// 	}
		// 	let endNode = this.splitTextUnit(end, endOffset)[0]

		// 	this.makeSelection(startNode, endNode)	
		// 	return this.findBetweenTextUnits(startNode, endNode)			
		// }
		return {};
	}

	selectAll() {
		if (this.target) {
			this.makeSelection(this.target.firstChild.firstChild, this.target.lastChild.lastChild)
		}
	}

	handleKeydown(e) {
		let key = e.key
		
		if (key == 'Backspace') {
			this.removePrintable(1);
		}
		if (key == 'Enter') {
			this.newLine();
		}
		if (key == 'Control') {
			this.state.control = true;
		}

		if (!this.state.control) {
			if (ContainerTextInjector.isPrintableCharacter(key)) {
				this.addPrintable(key)
			}
		}
		
		//stop annoying scroll down on space
		if (key in this.preventDefaults) {
			e.preventDefault();
		}
	}

	isLink(data) {
		var expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
		var regex = new RegExp(expression);
		
		return data.match(regex);
	}

	isData(text) {
		//data:image/jpeg;base64
		let colon = text.indexOf(':')
		let semi = text.indexOf(';')
		let firstCom = text.indexOf(',')

		let pre = text.substring(0, colon)
		let type = text.substring(colon+1, semi)
		
		let encsep = type.indexOf('/')
		let format = type.substring(encsep+1, type.length)
		type = type.substring(0, encsep)

		let encoding = text.substring(semi+1, firstCom)
		let data = text.substring(firstCom+1, text.length)

		if (pre == 'data') {
			return {
				content: type, 
				format: format,
				encoding: encoding,
				data: data
			}
		}
		return null;
	}

	textToStyle(text) {
		let units = text.split(";")
		let stl = {}
		for (const unit of units) {
			let parts = unit.split(":")
			if(parts.length == 2){
				stl[parts[0].trim()] = parts[1].trim();
			}
		}

		return stl;
	}

	handleKeyUp(e) {
		let key = e.key
		if (key == 'Control') {
			this.state.control = false;
		}

		if (this.state.control) {
			e.preventDefault();
			console.log(`CTRL ${key}`)
			if (key == 'b') {
				this.bold()
			}
			if (key == 'i') {
				this.italic()
			}
			if (key == 'u') {
				this.underlined()
			}
			if (key == '1') {
				this.align('left')
			}
			if (key == '2') {
				this.align('center')
			}
			if (key == '3') {
				this.align('right')
			}
			if (key == '4') {
				this.align('justify')
			}
			if (key == '+') {
				this.changeFontSize(1)
			}
			if (key == '-') {
				this.changeFontSize(-1)
			}
			if (key == 'a') {
				this.selectAll()
			}
			//special commands
			if (key == '/') {
				console.log("processing special command")
				//href - interpret text as link
				let units = this.getAllTextUnits()
				let text = ""
				for (const unit of units) {
					text += unit.innerText;
				}
				if (this.isLink(text)) {
					for(const unit of units) {
						this.container.delete(unit.id);
					}
					this.container.createFromSerializable(this.target.id, {
						nodeName:"img",
						src:text
					});
				}

				let r = this.isData(text)
				if (r) {
					if (r.content == 'image') {
						for(const unit of units) {
							this.container.delete(unit.id);
						}

						console.log("adding image...")
						this.container.createFromSerializable(this.target.id, {
							nodeName:"img",
							src:text
						});
					}
					console.log(r)
				}
			}
			if (key == ';') {
				let units = this.getAllTextUnits()
				let text = ""
				for (const unit of units) {
					text += unit.innerText;
				}

				let style = this.textToStyle(text)
				console.log(style)
				this.container.styleChild(this.target, style)
				
				for(const unit of units) {
					this.container.delete(unit.id);
				}
			}
		}
	}
}

let texter = new ContainerTextInjector(container);
texter.enable()