import { container } from "./nodeengine.js";
import { LiveBridge } from "./LiveBridge.js";

let bridge = new LiveBridge(container, false);
bridge.registerSocketIo();

export {container as container, bridge as bridge}