let index = 0
let workQueue = []
let maxUninterrupted = 10

//stats
let totalWork = 0;
let totalCompletedWork = 0;
let maxEverSize = 0;

function execute() {
	let uninterrupted = 0
	while (index < workQueue.length) {
		let workUnit = workQueue[index++]
		let start = Date.now()
		try {
			workUnit.callback.apply(workUnit.context, workUnit.params)	
		} catch (e) {

		}
		totalCompletedWork++;
		let duration = Date.now() - start
		uninterrupted += duration

		if (uninterrupted >= maxUninterrupted) {
			let overshot = uninterrupted - maxUninterrupted
			//setTimeout(execute, overshot+1)
			setTimeout(execute, 1)
			return;
		}
	}	 	
	//console.log(`YeldingExecutor: avg call duration: ${uninterrupted/index}ms\nTotal_queued:${totalWork}\nTotal_done__:${totalCompletedWork}\nMax Ever Queue size: ${maxEverSize}`)
	workQueue = []
	index = 0 
}

export function queueWork(callback, context, params) {
	workQueue.push({
		callback:callback,
		context: context,
		params:params
	});

	totalWork++;
	if (workQueue.length > maxEverSize) {
		maxEverSize = workQueue.length
	}
	if (workQueue.length == 1) {
		execute();
	}
}

export function queueConflatingWork(callback, context, params, conflatingId=null) {
	if (conflatingId) {
		//[TODO] implement conflation	
	}
	return queueWork(callback, context, params)
}

export function cancelWork(workId) {

}

export function cancelAllWork() {

}

export function status () {
	return workQueue.length
}

//[TODO]: ability to conflate work (via a computed work_unit_id. if you submit another work unit with the same id all previous unexecuted work units with the same id are skipped)
//[TODO]: ability to cancel all work in queue
//[TODO]: ability to remove from queue
//[TODO]: promise integration
//[TODO]: multiple queues (by queue name or priority?)