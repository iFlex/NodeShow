import {Container} from "./Container.js";
import "./container.serialization.js"
import "./container.positioning.js";
import "./container.staticcontent.js";
import "./container.actions.js";
import "./container.summarize.js";

import {LiveBridge} from "./LiveBridge.js";
//import "./container.extensions.js";

let container = new Container(document.body, false);
container.init();

let bridge = new LiveBridge(container, false);
bridge.registerSocketIo();

export {container as container, bridge as bridge}