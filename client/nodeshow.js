import {Container} from "./Container.js";
import "./container.serialization.js"
import "./container.positioning.js";
import "./container.staticcontent.js";
import "./container.actions.js";
import "./container.summarize.js";

import {LiveBridge} from "./LiveBridge.js";
//import "./container.extensions.js";

let root = document.body
try {
 root = document.getElementById('nodeshow-content')
} catch (e) {
 console.log("Did not initiate container on nodeshow-content, defaulting to document.body")	
}

let container = new Container(root, false);
container.init();

let bridge = new LiveBridge(container, false);
bridge.registerSocketIo();

export {container as container, bridge as bridge}