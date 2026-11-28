# Prompt Log
I primarily used Codex in VS Code for this assignment. I used GPT 6.2 Sol for the majority of the building, and GPT 6.1 Terra for concept explanation and review.

## Selected Prompts - Verbatim

### Learning about Expo / React Native
- `What is React Native with Expo Go? I have some web dev experience, but know very little about making phone apps.`
- `do a little demo of react / react native in the current phone app. it should be short, just change a couiple things.`

### Prompting to Explore Possible Capabilities of the Phone App
- `Don't add to the project, but is it possible to include a draggable map on the screen (ex: google maps, or an open source one if that's not legal), get the phone's location, and allow the user to add location-based pins? What issues what I encounter?`
- `As just a prototype, does google maps work? What does react-native-maps provide? does it provide the mapping details, or just the display of a map?`
- `can i allow the app to access the camera?`
- `How do i make the app store on the phone locally, and have information persist?`
- `what is AsyncStorage?`
- `Does expo map call an api?`

### Fixing Bugs
```
There are a couple breaking bugs (not necessarily in the review\.md)

- Taking photos doesn't work. The camera turns on and I can see it, but pressing the "take photo" button doesn't do anything.
- In follow mode, the center of the map should track the user -- if the user moves, it should also continue moving. For this bullet point, clarify this point as an extra phrase in the SPEC.md

Then troubleshoot and fix these issues.
```

```
"Follow me" still doesn't work - the app opens at the prime meridian, as expected, but follow me doesn't move the map screen to the user's location, even though it says "following your location"
```

```
Implement these changes (except for points 6 and 7). Read the project more to understand before doing so.
```

### Changing the Interface
```
I want to make a visual/interface change. Don't code, but read this, plan out any remaining important details, and ask me any questions.

Change the map screen's "mode switcher" into a single rounded button in the top right corner with an icon (use svg). When in follow mode, the button should be highlighted blue, but when in manual explore mode, it should be desaturated and gray. You can click the button to return back to follow mode. If there is some sort of connection or location issue, this button should change to a different icon to show that.
```
```
Also remove the "toggle zoom" button on the photo-viewing screen. The user can just manually pinch-and-zoom already.
```
```
Allow the user to delete notes directly from the "all notes" page with an "x" button. This should popup an "are you sure" dialogue.
Also do this for photos.
```
```
For the titles of each page (added as a stack.screen option), can you make this text bigger and bolder? what else can I do with it? Don't do anything before I approve.
```