import type Enstringable from "./Enstringable";
import type Destringable from "./Destringable";
export default interface Stringable<T> extends Enstringable, Destringable<T> {
}
