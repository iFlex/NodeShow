//ToDo: find a way to depend on the original rather than copy paste it from client code in here every time it changes
const ACTIONS = {
    create: 'container.create',
    delete: 'container.delete',
    setParent: 'container.set.parent',
    update: 'container.update',
    
    setPosition: 'container.setPosition',
    setWidth: 'container.set.width',
    setHeight: 'container.set.height',
    setAngle: 'container.set.angle',
    setSiblingPosition: 'container.set.sibling.position',
    hide: 'container.hide',
    show: 'container.show',
	//permissions pertaining to the server
	broadcast: 'container.broadcast',
	persist: 'container.persist'
}

module.exports = ACTIONS