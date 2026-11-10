# Android app for the team

Half the team is on Android, some on old phones. There are three ways, from easiest to most work. All of them show the same app, so guides on iPhone and Android see the same thing.

## 1. Install from Chrome (works today, nothing to build)
1. Open the app address in Chrome.
2. Menu (three dots) > **Install app** or **Add to Home screen**.
3. It gets its own icon, opens full screen, works offline after the first sign-in.

Needs Chrome that still updates: Android 8 or newer shows everything as designed. On Android 5 to 7 Chrome stopped updating; the app opens and works, but some background colours are missing.

## 2. A real Android package (APK) from the hosted app, no coding
This makes an installable Android app that wraps the same hosted app. It is the recommended way to get "a native app" for yourselves.
1. Finish `START-HERE.md` first: the app must be online at its https address.
2. Open pwabuilder.com, paste the app address, press **Start**.
3. Choose **Package for stores > Android**. Keep the defaults. Set the package id, for example `ge.friendly.schedule`.
4. Download the zip. Inside is an `.apk` (for sending to phones directly) and an `.aab` (for Google Play).
5. It also gives a file `assetlinks.json`. Put it in the repository at `.well-known/assetlinks.json` and publish. Without it the app still works but shows a browser bar at the top.
6. Send the `.apk` to the team (WhatsApp, Telegram). Each person opens it and allows "install from this source" once.

Cost: nothing. A Google Play account ($25 once) is needed only if you want it in the Play Store.
Not tested by me: I could not build or install the package from here. Try it on one phone before sending it to everyone.

## 3. A separately written native Android app
A developer rewrites the screens in Android code. It makes sense only if you need things a web app cannot do (for example working with no browser engine on very old phones). My rough estimate is several thousand dollars and ongoing upkeep for every change. I do not recommend it now.

## Old phones: what to check
- Open the app on the oldest phone in the team and go through one tour card, one check-in and one day-off request.
- If Chrome on that phone cannot update any more, tell me the Android version. I can add simpler colours for old Chrome so nothing looks broken.
