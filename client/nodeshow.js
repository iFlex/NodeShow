import {Container} from "./Container.js";
import "./container.serialization.js"
import "./container.positioning.js";
import "./container.staticcontent.js";
import "./container.actions.js";
import "./container.summarize.js";
import "./container.links.js";

import {LiveBridge} from "./LiveBridge.js";
//import "./container.extensions.js";

let root = document.getElementById('nodeshow-content')
if (!root) {
    console.log(`No nodeshow-content container fount. Initialising engine on document.body`)
    root = document.body
}

let container = new Container(root, false);
container.init();

let bridge = new LiveBridge(container, false);
bridge.registerSocketIo();

export {container as container, bridge as bridge}