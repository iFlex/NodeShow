export class ContainerException {
    #id = null
    #method = null
    #callerId = null
    #reason = null

    console(id, method, callerId, reason) {
        this.#id = id
        this.#method = method
        this.#callerId = callerId
        this.#reason = reason
    }

    exactComparableString() {
        return `call ${this.method} on ${this.id} by ${this.callerId} FAILED because:${this.reason}`
    }

    comparableString() {
        return `ContainerException`
    }
}

export class ContainerOperationDenied {
    id = null
    callerId = null
    operation = null

    console(id, opreation, callerId) {
        this.id = id
        this.operation = operation
        this.callerId = callerId
    }

    exactComparableString() {
        return `DENIED_${this.operation}_on_${this.id}_to_${this.callerId}`
    }

    comparableString() {
        return `ContainerOperationDenied`   
    }
}

export class ContainerOperationNotApplicable {
    #id = null
    #operation = null

    constructor(id, op) {
        this.#id = id
        this.#operation = op
    }

    exactComparableString() {
        return `OPERATION_NO_APPLICABLE:${this.operation}_on_${this.id}`
    }

    comparableString() {
        return `ContainerOperationNotApplicable`   
    }
}