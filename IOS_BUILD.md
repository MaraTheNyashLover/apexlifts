# Apex Lifts — first iOS build (TestFlight)

You need: a Mac, your Apple Developer account, your iPhone, a USB cable (or same Wi‑Fi).
Time: about 2 hours the first time, mostly waiting on downloads.

## 0. Before you sit down at the Mac
- Download `apexlifts-ios.zip` from this project folder and get it onto the Mac (AirDrop, USB stick, email to yourself).
- On your iPhone, install the **TestFlight** app from the App Store.

## 1. Install the tools (one time)
1. Open the **App Store** on the Mac, search **Xcode**, click Get. It is about 7 GB. Start this first.
2. Open **Terminal** (Spotlight: press Cmd+Space, type Terminal, Enter).
3. Install Node by pasting this and pressing Enter:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && brew install node
   ```
   Follow any prompts. If it asks for the Mac's password, that is the login password of whoever owns the Mac.
4. When Xcode has installed, open it once. Accept the license. Let it install "additional components". Quit it.
5. Point the Mac at the full Xcode (one time, asks for the Mac password):
   ```
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -license accept
   ```

## 2. Open the project
1. Unzip `apexlifts-ios.zip`. You get a folder called `ios-app`.
2. In Terminal, type `cd ` (with a space), drag the `ios-app` folder into the Terminal window, press Enter.
3. Paste and run:
   ```
   npm install && npx cap sync ios && npx cap open ios
   ```
   Xcode opens the project. The first open takes a few minutes while it downloads the Swift packages. Wait until the activity bar at the top goes quiet.

## 3. Sign the app with your account
1. In Xcode's left sidebar click the blue **App** icon at the very top.
2. In the middle, under **TARGETS**, click **App**.
3. Click the **Signing & Capabilities** tab.
4. Tick **Automatically manage signing**.
5. **Team**: pick your name. If it is not there: Xcode menu → Settings → Accounts → + → Apple ID → sign in with your developer Apple ID, then come back.
6. **Bundle Identifier** must read `com.gymtitles.app`. Do not change it.
7. Capabilities should already show **Sign in with Apple** and **Push Notifications**. If either is missing, click **+ Capability** at the top left of that pane and add it.
8. If Xcode shows a red error about provisioning, click **Try Again**. It usually clears after a few seconds.

## 4. Run it on your phone first
1. Plug the iPhone into the Mac. Unlock it and tap **Trust** if asked.
2. At the top of Xcode, click the device dropdown (it says something like "iPhone 15 Pro Simulator") and pick **your iPhone** under Devices.
3. Press the **▶ Play** button (top left). First run takes a few minutes.
4. On the iPhone, if it says "Untrusted Developer": Settings → General → VPN & Device Management → tap your developer name → Trust. Then run again.
5. The app opens. Create an account, submit a lift. Test video upload, location, and Continue with Apple.

## 5. Upload to TestFlight
1. In Xcode's device dropdown pick **Any iOS Device (arm64)**.
2. Menu bar: **Product → Archive**. Wait for the Organizer window.
3. Click **Distribute App** → **TestFlight & App Store** → **Distribute**. Accept defaults. It uploads.
4. Go to https://appstoreconnect.apple.com → **Apps**. The first time, click **+ → New App**:
   - Platform iOS, Name **Apex Lifts**, Primary language English, Bundle ID **com.gymtitles.app**, SKU `gymtitles-ios`.
5. In the app → **TestFlight** tab. The build appears after 5 to 15 minutes of "Processing".
6. Click the build → answer the export compliance question **No** (it does not use custom encryption).
7. **Internal Testing** → **+** → create a group, add yourself. TestFlight on your phone will show the app. Install it.
8. Add up to 100 internal testers by Apple ID email, or create an **External** group for a public link (external needs a quick Apple review, usually a day).

## 5b. App Store Connect listing (do once, any computer)
In App Store Connect → your app → the version page:
- **Screenshots**: the five files in `store-assets/screenshots-6.9in/`.
- **Description, keywords, promotional text**: see `STORE_LISTING.md`.
- **Privacy Policy URL**: https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b (set it to public from its Share menu first).
- **Support URL**: same link for now.
- **Age rating**: answer the questionnaire; expect 12+ or 17+ depending on the unrestricted web access answer (answer No).
- **App Privacy**: declare Email, Name (handle), Precise Location, Photos or Videos, User ID, Device ID (push token), Other usage data. All "used for app functionality", linked to the user, not used for tracking.
- **Sign-in required**: give the test lifter account.
- **Category**: Health & Fitness. Secondary: Social Networking.

## 6. Every later update
In Terminal, inside the `ios-app` folder:
```
npx cap sync ios && npx cap open ios
```
Then in Xcode: bump **Build** number by 1 (Signing & Capabilities tab → General tab → Build), Product → Archive → Distribute. About 15 minutes.

## If the app crashes at launch with EXC_BREAKPOINT
Newer iOS requires the scene-based app lifecycle. The project now includes `App/SceneDelegate.swift` and a scene manifest in Info.plist. If you ever regenerate the iOS project from scratch, copy those two things back in.

## Note on names
The app is called **Apex Lifts**. The Bundle ID stays `com.gymtitles.app` (internal, never shown to users, cannot change). The App ID on Apple's site is still described as "Gym Titles"; that description is cosmetic and can be edited there any time.

## Test accounts (keep private)
All three use the password `TestPass!2026`.
- `test-lifter@gymtitles.local` — a lifter with no lifts yet
- `test-verifier-a@gymtitles.local` — verifier
- `test-verifier-b@gymtitles.local` — verifier
Give the lifter account to Apple's reviewer in App Store Connect under "Sign-in required". Change the passwords before launch.

## Still to do before App Store submission
- Push notifications: done. Production key V64J68G6XL is on the server and verified against Apple's production and sandbox servers. Nothing to do.
- Privacy policy and terms: written (site/legal/index.html, also at https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b). Set that link to public from its Share menu, or host the file elsewhere, and fill in the contact email and state placeholders. Paste the privacy URL into App Store Connect → App Privacy.
- App icon and splash: installed in the Xcode project (nothing to do). Screenshots: upload the five PNGs in `store-assets/screenshots-6.9in/` to App Store Connect → your app → the iOS version page → iPhone 6.9" Display, in numbered order. Apple scales them for smaller phones.
- Change `aps-environment` in App/App.entitlements from `development` to `production` for the store build (Xcode usually does this for you on Archive).
