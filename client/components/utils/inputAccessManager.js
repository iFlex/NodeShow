export const ACCESS_REQUIREMENT = {
	// Access will be given to all listeners 
	DEFAULT:       0,
	// Access will be given to all DEFAUL and only one SET_EXCLUSIVE out of all SET_EXCLUSIVE
	SET_EXCLUSIVE: 1,
	// Access will be given to only one EXCLUSIVE listener. DEFAULT will never get access unless specifically granted
	EXCLUSIVE:     2,
    // Access will be given to all listeners with SET_INCLUSIVE, all others will not receive the event unless specifically granted.	
	//[TODO]: not implemented
	SET_INCLUSIVE: 3
}

/** @class
 *  @summary Component managing simultaneous access to input events.
 *  @description This access manager controlls which of the registered listeners of an event
 *  will receive that event when it fires. This is achieved by registering listeners with a desired access mode (default, set_exclusive, and exclusive).
 *  The semantic of this is: By registering listener a with access mode M for event _e, we mean that a should always have access mode M for event _e. 
 * 	
 * 	[TODO][NOT_IMPLEMENTED]There is also a way to temporarily grant a different access mode to a listener on demand. This is meant to be used for transactional workloads.
 *  e.g. There's a service always listening in on paste events preventing default bubbling up in order to provide its functionality.
 *       There is also an application that when enabled needs to have exclusive access to paste events so that it can let the event bubble up to the browser (for populating text fields). 
 *       The intended behaviour here is that the service should receive the paste events as long as the application is not enabled. When the application is enabled, all paste events are routed to it.
 *       Then when it is disabled, it releases the exlusive access and the service receives further paste events.
 * 
 *  Currently this can be achieved by registering and unregistering a new listener with EXCLUSIVE access mode.
 	[TODO]: maintain order of registering, so when someone registers with EXCLUSIVE access - the latest such register gets the access. then when they unregister the one registered before it gets the access and so on.
 * */ 
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