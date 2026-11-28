# 15-113 Homework 10 Phone App - Field Notes
Field Notes is a notes and photo-taking app where notes are located at the position you take them! You can search on a map where each note is, which helps you organize your thoughts spatially, unlike other note apps.

This assignment was made for 15-114 (Effective Coding with AI Part 2), and was made with much assistance with OpenAI's Codex. See the [prompt log](prompt_log.md) for more information!

## User Screens
1. Map
  - This is the main screen of the app, where users see all their notes on a map.
  - Press the "follow" icon on the top right to follow your phone.
  - Tapping the buttons at the bottom to create a new text note or take a photo.
  - Or, pan around and **long tap** to leave a note anywhere!
2. Create New Note/Photo
  - Leave a text note or take a photo.
3. Edit Note/Photo
  - Click a pin on the map to view its corresponding note or photo.
  - You can also edit or delete the note from this screen.
4. All Notes
  - This shows all your notes in a list, including ones with no map location (created when offline).

Permissions - Location and Camera required to use all features of this app.

## Running the Project
This project was run on Node.js 26.13.0 using Expo SDK 58, and tested on iOS.
1. Install dependencies
   ```bash
   npm install
   ```
2. Start the app
   ```bash
   npx expo start
   ```
3. Open the app
I downloaded [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo.

## Parts not fixed in REVIEW
In [REVIEW.md](REVIEW.md), two warnings (16, 19) were not resolved.
- #16 - Testing - An Android device was not used to test the app.
- #19 - Scalability - This project was created as a prototype, so I did not write this with time or space efficiency as a major priority. This may run very slowly with an increasing number of notes and photos.

## What I Learned about Mobile App Development
One thing I learned about mobile app development is that many parts of expo depend on the phone's native system. For example, using `react-native-maps` is implemented to use Apple Maps on iPhones and Google Maps on Android phones.