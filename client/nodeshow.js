import {Container, LiveBridge} from "./Container.js";
import "./container.positioning.js";
//import "./container.extensions.js";

let container = new Container(document.body);
container.init();

let bridge = new LiveBridge(container);
bridge.registerSocketIo();

export {container as container}