/*
Value Converter
https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units
*/
export const SUPPORTED_MEASURING_UNITS = new Set(['px','%','el'])

export function convertAbsoluteUnit(value, fromUnit, toUnit) {
	return value
}

export function convertRelativeUnit(value, fromUnit, toUnit, parent) {
	
}

export function convert(value, fromUnit, toUnit, parent) {
	return convertAbsoluteUnit(value, fromUnit, toUnit)	
}