# Phone App Specification

## Overview
I'm making "Field Notes", a phone app in React Native / Expo Go that is a location-based notetaking and viewing device.

## Core Features
The user should be able to take notes and photos. Using the phone's GPS/location, that note or photo is located at the position of writing.
The user should be able to see all their notes nearby to them on a map (notes visible in the current map area).
The user should also be able to edit and delete their notes and photos.

## Screens & Navigation

Map Screen
- Shows the user where they are.
- Shows all notes located on the screen. If there are too many notes to display in a particular place, do some visual "coagulation".
- This should be the main page of the app.
- The map can be in "follow" mode, which follows the user's real-world location as they move around.
- Or, the user can zoom in/out and move the map to look elsewhere. When this happens, let the user return to follow mode using a button.
- Also allow a long tap anywhere on the map interface to create a note or take a photo that is localized there.
- There should be a plus / camera icon to add a note and take a photo, respectively. They will be located at the user's location (if in follow mode) or the center of wherever the map screen is zoomed to.
- The notes/photo location should be sampled at moment of button press, since the user might move in the middle of a photo or while taking notes.

Camera Screen
- Allows the user to take a photo, and save or delete it before adding.

Photo Display Screen
- When an existing photo is interacted with, the image should be displayed larger and allow for zooming in. It should also allow the user to permanently delete that image.

Notes Screen
- The map does not need to be shown here.
- Allows the user to take notes with basic text editing features.
- Each note has a title field.
- Allow the user to delete the note from this page as well.

All Notes
- Display all notes and photos in a vertical scrolling list, and tap to interact with the note in more detail. Text notes should enter the notes screen, and photos should enter the photo display screen.
- The list should be sorted by the note's created timestamp.
- Here, each text note displays its title, and photo thumbnails are shown (shrunk to fit in the list).

## Data Model
A local database should store the location-tagged notes and photos. Notes and photos are separate entity types.

### Entities
Note:
- id: whatever type the database uses
- title: string
- body: string (multiline supported)
- modified: timestamp
- created: timestamp
- location: coordinates

Photo:
- id: whatever type the database uses
- photo: image
- created: timestamp
- location: coordinates

## API & Backend
- **Backend:** No backend. This entire app should be local on the phone.
- **Authentication:** No authentication needed.
- **Database:** expo-sqlite for persistent local storage
- **Third-party APIs:** expo-camera to take a photo, react-native-maps to get map display and information.

## Design & Branding

- **Color palette:** Tan/beige as the background, and an orange/yellow as an accent color.
- **Typography:** Sans-serif font, should be clean.
- **Style direction:** It should fit the vibe of "field notes", but should be minimalist-looking.

## Platform Targets

- [X] iOS
- [X] Android

## Notifications & Background Tasks
- There should be no push notifications or background tasks.

## Exceptions
- Without network connectivity, the app should clearly display this on the map screen. Allow the user to enter to the "all notes" screen and view their notes in more detail.
- Users can still create and view saved entries offline, while the map may be incomplete or unavailable. These notes will not have a location and do not show up on the map, but can be seen in the All Notes page.
- If location permissions are not disabled, just allow for moving/panning to set the location of new tasks.

## Open Questions