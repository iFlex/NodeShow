export const ACCESS_REQUIREMENT = {
	// Access will be given to all listeners 
	DEFAULT:       0,
	// Access will be given to all DEFAUL and only one SET_EXCLUSIVE out of all SET_EXCLUSIVE
	SET_EXCLUSIVE: 1,
	// Access will be given to all listeners with SET_INCLUSIVE, all others will not receive the event unless specifically granted.	
	//[TODO]: not implemented
	SET_INCLUSIVE: 2,
	// Access will be given to only one EXCLUSIVE listener. DEFAULT will never get access unless specifically granted
	EXCLUSIVE:     3
}

/** @class
 *  @summary Component managing simultaneous access to input events.
 *  @description This access manager controlls which of the registered listeners of an event
 *  will receive that event when it fires. This is achieved by registering listeners with a desired access mode (default, set_exclusive, and exclusive).
 *  The semantic of this is: By registering listener a with access mode M for event _e, we mean that a should always have access mode M for event _e.
 * 
 *  When a new listener registers, the manager recomputes who the access should be given to. Newer registered listeners will take precedence over older ones with the same access requirement.
 * 
 *  e.g. Register Listener_1 for event_1 with EXCLUSIVE -> Listener_1 gets the events
 *       now Register   Listener_2 for event_1 with EXCLUSIVE -> Listener_2 gets the events now
 * 		     Unregister Listener_2 for event_1 with EXCLUSIVE -> Listener_1 gets the events 
 * 	
 *  This can be overrided by calling grant(), which has the power to override even access mode requirements.
 *  e.g. Registered Listener_1 for event_1 with EXCLUSIVE, Listener_2 for event_1 with EXCLUSIVE, Listener_3 for event_1 with DEFAULT
 * 	     then grant(event_1, Listener_3) will cause the input access manager to send the events to Listener_3.
 * 		 [TODO]: input access manager should route events based on what access mode the granted listenre has. Effectively if you have 2 exclusive listeners and 3 default, if you grant one of the defaults then all defaults should get the events but none of the exclusives 
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
		
	getGrantAtLevel(event, mode) {
		if (this.#grants[event] && this.#grants[event].grantedTo) {
			let grantedTo = this.#grants[event].grantedTo
			let listenerMode = this.#access[event][grantedTo].mode

			if (listenerMode == mode) {
				return [grantedTo]
			} else {
				return []
			}
		}

		return null
	}

	getDefaultListeners(event) {
		let result = []
		for (const [id, listenerDetail] of Object.entries(this.#access[event])) {
			let mode = listenerDetail.mode
			if ( mode == ACCESS_REQUIREMENT.DEFAULT ) {
				result.push(id)
			}
		}
		return result
	}

	getLatestSetOrExclusive(event, setOrExclusiveMode) {
		if (setOrExclusiveMode !== ACCESS_REQUIREMENT.SET_EXCLUSIVE 
			&& setOrExclusiveMode !== ACCESS_REQUIREMENT.EXCLUSIVE) {
			return []
		}
		
		let grantAtLevel = this.getGrantAtLevel(event, setOrExclusiveMode)
		if (grantAtLevel) {
			return grantAtLevel
		}

		let latestId = null;
		let latestTime = null;
		for (const [id, listenerDetail] of Object.entries(this.#access[event])) {
			let mode = listenerDetail.mode
			let time = listenerDetail.time
			if ( mode == setOrExclusiveMode ) {
				if (latestTime == null || latestTime < time) {
					latestId = id
					latestTime = time
				}
			}
		}

		if (latestId) {
			return [latestId]
		}
		return []
	}

	getSetInclusiveListeners(event) {
		let grantAtLevel = this.getGrantAtLevel(event, ACCESS_REQUIREMENT.SET_INCLUSIVE)
		if (grantAtLevel) {
			return grantAtLevel
		}

		let result = []
		for (const [id, listenerDetail] of Object.entries(this.#access[event])) {
			let mode = listenerDetail.mode
			if ( mode == ACCESS_REQUIREMENT.SET_INCLUSIVE ) {
				result.push(id)
			}
		}
		return result
	}

	//Assumes this.#grants[event] is populated
	recomputeAllowedListeners(event) {
		let accessMode = this.#grants[event].mode
		let listeners = []

		if (accessMode == ACCESS_REQUIREMENT.DEFAULT || accessMode == ACCESS_REQUIREMENT.SET_EXCLUSIVE) {
			listeners.push(this.getDefaultListeners(event))
		}
		if (accessMode == ACCESS_REQUIREMENT.SET_EXCLUSIVE) {
			listeners.push(this.getLatestSetOrExclusive(event, ACCESS_REQUIREMENT.SET_EXCLUSIVE))
		}
		if (accessMode == ACCESS_REQUIREMENT.EXCLUSIVE) {
			listeners.push(this.getLatestSetOrExclusive(event, ACCESS_REQUIREMENT.EXCLUSIVE))
		}
		if (accessMode == ACCESS_REQUIREMENT.SET_INCLUSIVE) {
			listeners.push(this.getSetInclusiveListeners(event))
		}

		let resultSet = new Set()
		for (const group of listeners) {
			for (const listener of group) {
				resultSet.add(listener)
			}
		}

		this.#grants[event].allowedReaders = Array.from(resultSet)
	}

	recomputeAccessMode(event) {
		let currentMode = ACCESS_REQUIREMENT.DEFAULT
		
		let grantedMode = null;
		let grantedTo = null;
		let grantFound = false;
		if (this.#grants[event] && this.#grants[event].grantedTo) {
			grantedTo = this.#grants[event].grantedTo
		}

		//find most restrictive mode
		for ( const [id, listenerDetail] of Object.entries(this.#access[event]) ) {
			let mode = listenerDetail.mode
			if ( currentMode < mode ) {
				currentMode = mode
			}

			if (grantedTo == id) {
				grantFound = true
				grantedMode = mode || ACCESS_REQUIREMENT.DEFAULT
			}
		}

		if (!this.#grants[event]) {
			this.#grants[event] = {}
		}

		if (grantFound) {
			this.#grants[event].mode = grantedMode
		} else {
			this.#grants[event].mode = currentMode
			this.#grants[event].grantedTo = null;
		}
	}

	recomputeState(event) {
		this.recomputeAccessMode(event)
		this.recomputeAllowedListeners(event)
		console.log(`INPUT_ACCESS_MANAGER: ${event} has access mode ${this.#grants[event].mode} and ${this.#grants[event].allowedReaders.length} listeners out of ${Object.keys(this.#access[event]).length}`)
		console.log(this.#grants[event].allowedReaders)
	}

	register(event, listenerId, accessReq) {
		if (!(event in this.#access)) {
			this.#access[event] = {}
		}

		if (!accessReq) {
			accessReq = ACCESS_REQUIREMENT.DEFAULT
		}

		this.#access[event][listenerId] = {
			mode: accessReq,
			time: Date.now()
		}

		console.log(`INPUT_ACCESS_MANAGER: registered ${listenerId} for ${event} with ${accessReq} access`)
		this.recomputeState(event)
	}

	unregister(event, listenerId) {
		delete this.#access[event][listenerId]
		console.log(`INPUT_ACCESS_MANAGER: unregister ${listenerId} for ${event}.`)
		this.recomputeState(event)
	}

	unregisterAll(listenerId) {
		for (let [event, entry] of Object.entries(this.#access)) {
			if (listenerId in entry) {
				this.unregister(event, listenerId)
			}
		}
	}

	grant(event, listenerId) {
		if (!this.#grants[event] ) {
			this.#grants[event] = {
				allowedReaders: null
			}
		}
		this.#grants[event].grantedTo = listenerId
		this.recomputeState(event)
	}

	revoke (event, listenerId) {
		if (!this.#grants[event]) {
			return;
		}

		if (this.#grants[event].grantedTo !== listenerId) {
			return;
		}

		this.recomputeState(event)
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