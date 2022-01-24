let index = 0
let workQueue = []
let maxUninterrupted = 10
let totalWork = 0;
let totalCompletedWork = 0;

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
	console.log(`YeldingExecutor: avg call duration: ${uninterrupted/index}ms\nTotal_queued:${totalWork}\nTotal_done__:${totalCompletedWork}`)
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

	if (workQueue.length == 1) {
		execute();
	}
}

export function status () {
	return workQueue.length
}