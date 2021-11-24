import {Container} from "./Container.js";
import {LiveBridge} from "./LiveBridge.js";
import "./container.positioning.js";
import "./container.staticcontent.js";
import "./container.actions.js";
import "./container.summarize.js";
//import "./container.extensions.js";

let container = new Container(document.body);
container.init();

let bridge = new LiveBridge(container);
bridge.registerSocketIo();

export {container as container, bridge as bridge}