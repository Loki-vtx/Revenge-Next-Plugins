import { ... } from "@revenge-mod/...";

const patches: Array<() => void> = [];

const TypingStore = 
if (TypingStore) {
    patches.push(
        
    );
}

export const onUnload = () => {
    patches.forEach((unpatch) => unpatch());
    patches.length = 0;
};
