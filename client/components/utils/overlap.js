/** @class
 *  @summary Utility class implementing helper functions for determining container overlap.
 *  @description A set of methods implementing helper functions for determining container overlap 
 * */
export class ContainerOverlap {
    #container = null;

    constructor (container) {
        this.#container = container;
    }

    doBoundingBoxOverlap (leftBBox, rightBBox) {
        return !(
            leftBBox.right <= rightBBox.left 
            || leftBBox.left >= rightBBox.right
            || leftBBox.top >= rightBBox.bottom 
            || leftBBox.bottom <= rightBBox.top)
    }

    calculateOverlapBBox (leftBBox, rightBBox) {
        if (this.doBoundingBoxOverlap(leftBBox, rightBBox)) {
            return {
                left:(leftBBox.left < rightBBox.left) ? rightBBox.left : leftBBox.left, 
                right:(leftBBox.right < rightBBox.right) ? leftBBox.right : rightBBox.right,
                top:(leftBBox.top < rightBBox.top) ? rightBBox.top : leftBBox.top,
                bottom:(leftBBox.bottom < rightBBox.bottom) ? leftBBox.bottom : rightBBox.bottom 
            }
        }
        return undefined;
    }
    
    getOverlapBBox(left, right) {
        let leftBBox = this.#container.getBoundingBox(left)
        let rightBBox = this.#container.getBoundingBox(right)

        return this.calculateOverlapBBox(leftBBox, rightBBox);
    }

    getOverlapArea(bbox) {
        if (!bbox) {
            return 0;
        }

        return (bbox.right - bbox.left) * (bbox.bottom - bbox.top)
    }

    getOverlappingSiblings(targetId) {
        let target = this.#container.lookup(targetId);
        let result = []
        for (let sib of target.parentNode.children) { //childNodes
            if (sib.id !== target.id) {
                let overlapA = this.getOverlapArea(this.getOverlapBBox(target, sib))
                if (overlapA) {
                    let overlapP = overlapA / (this.#container.getWidth(sib) * this.#container.getHeight(sib))
                    result.push({id: sib.id, overlap: overlapA, overlapPercent: overlapP})
                }
            }
        }

        return result
    }
}