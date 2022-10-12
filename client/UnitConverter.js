/*
Value Converter
https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units
*/
export const SUPPORTED_MEASURING_UNITS = new Set(['px','%','el','auto','inherit'])

/**
* @summary Detects the measuring unit of a given value. e.g. px, %, et
* @param {string} val - the id or DOM object reference to check
* @returns {string} the measuring unit of the given value
*/
export function inferUnit(value) {
	for (const unit of SUPPORTED_MEASURING_UNITS) {
		if (value.endsWith(unit)) {
		    return unit
		}
	}
    return undefined
}

function stripUnit(value, unit) {
	return parseInt(value.replace(unit,''))
}

export function convertAbsoluteUnit(value, fromUnit, toUnit) {
	if (toUnit == 'auto') {
		return ''
	}
	
	return value
}

export function convertRelativeUnit(value, fromUnit, toUnit, parent) {
	
}

export function convert(value, fromUnit, toUnit, parent) {
	return convertAbsoluteUnit(value, fromUnit, toUnit)	
}

export function convertToStandard(valueWithUnit, parent) {
	let unit = inferUnit(valueWithUnit)
	let value = stripUnit(valueWithUnit, unit)
	return convert(value, unit, 'px', parent)
}