let index = 0
let workQueue = []
let maxUninterrupted = 100

function execute() {
	let uninterrupted = 0
	while (index < workQueue.length) {
		let workUnit = workQueue[index++]
		let start = Date.now()
		try {
			workUnit.callback.apply(workUnit.context, workUnit.params)	
		} catch (e) {

		}
		let duration = Date.now() - start
		uninterrupted += duration

		if (uninterrupted >= maxUninterrupted) {
			let overshot = uninterrupted - maxUninterrupted
			setTimeout(execute, overshot + 10)
		}
	}	 	
	console.log(`YeldingExecutor: avg call duration: ${uninterrupted/index}ms`)
	workQueue = []
	index = 0
}

export function queueWork(callback, context, params) {
	workQueue.push({
		callback:callback,
		context: context,
		params:params
	});

	if (workQueue.length == 1) {
		execute();
	}
}