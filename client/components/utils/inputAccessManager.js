export const ACCESS_REQUIREMENT = { 
	DEFAULT:       0, // access will be given to all listeners
	SET_EXCLUSIVE: 1, // access will be given to all DEFAUL and only one SET_EXCLUSIVE out of all SET_EXCLUSIVE
	EXCLUSIVE:     2  // access will be given to only one EXCLUSIVE. DEFAULT will never get access unless specifically granted
}

export class InputAccessManager {
	#access = {}
	#grants = {}
	
	recomputeAccessMode(event) {
		let allowedReaders = new Set([])
		let currentMode = ACCESS_REQUIREMENT.DEFAULT

		for ( const [id, mode] of Object.entries(this.#access[event]) ) {
			if ( currentMode < mode ) {
				currentMode = mode
				if ( currentMode == ACCESS_REQUIREMENT.EXCLUSIVE ) {
					allowedReaders = new Set([])
				}
			}

			if (   ( this.#grants[event] && this.#grants[event].grantedTo == id ) 
				|| ( currentMode < ACCESS_REQUIREMENT.EXCLUSIVE && mode == ACCESS_REQUIREMENT.DEFAULT ) ) {
				allowedReaders.add(id)
			}
		}

		if (!this.#grants[event]) {
			this.#grants[event] = {}
		}

		this.#grants[event].mode = currentMode
		this.#grants[event].allowedReaders = allowedReaders
	}

	register(event, listenerId, accessReq) {
		if (!(event in this.#access)) {
			this.#access[event] = {}
		}

		if (!accessReq) {
			accessReq = ACCESS_REQUIREMENT.DEFAULT
		}

		this.#access[event][listenerId] = accessReq
		this.recomputeAccessMode(event)
	}

	unregister(event, listenerId) {
		delete this.#access[event][listenerId]
		this.recomputeAccessMode(event)
	}

	unregisterAll(listenerId) {
		for (let [event, entry] of Object.entries(this.#access)) {
			if (listenerId in entry) {
				delete entry[listenerId]
				this.recomputeAccessMode(event)
			}
		}
	}

	grant(event, listenerId) {
		if (!this.#grants[event] ) {
			this.#grants[event] = {
				grantedTo: undefined,
				allowedReaders: new Set([])
			}
		}

		this.#grants[event].grantedTo = listenerId
		this.recomputeAccessMode(event)
	}

	revoke (event, listenerId) {
		if (!this.#grants[event]) {
			return;
		}

		this.#grants[event].grantedTo = undefined;
		this.recomputeAccessMode(event)
	}

	getGrant(event) {
		if ( this.#grants[event] ) {
			return this.#grants[event].grantedTo
		}

		return undefined;
	}

	getAllowed(event) {
		if (!this.#grants[event]) {
			return new Set([])
		}

		return this.#grants[event].allowedReaders
	}

}

let iam = new InputAccessManager();
export { iam as InputAccessManagerInstance }