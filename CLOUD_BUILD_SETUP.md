# Cloud builds: no Mac needed

Once this is set up, every iOS build and TestFlight upload runs on a rented Mac at GitHub.
I push code, GitHub builds it, it lands in TestFlight on your phone. Free tier covers it
(a build uses about 15 minutes of the 2,000 free minutes a month).

## What you do (one time, about 10 minutes)

### 1. GitHub (3 min)
1. Create a free account at https://github.com/signup if you don't have one.
2. Create a new repository: https://github.com/new. Name `apexlifts`, set it to **Private**,
   leave everything else unchecked, click Create.
3. Connect GitHub to Claude: https://claude.ai/connect-github. Install the Claude GitHub App
   on the `apexlifts` repository when it asks which repos.
4. Tell me the repo name (for example `yourname/apexlifts`).

### 2. App Store Connect API key (2 min)
This is a different key from the push key you already made.
1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. If asked, click **Request Access** and accept the terms.
3. Click the **+** (Generate API Key). Name: `Cloud builds`. Access: **Admin**. Generate.
4. Click **Download API Key**. You can only download it once. Send me the file
   (`AuthKey_XXXXXXXXXX.p8`).
5. Copy the **Issuer ID** at the top of the page and the **Key ID** from the row, and send me both.

### 3. App record in App Store Connect (2 min)
1. https://appstoreconnect.apple.com/apps, click **+**, **New App**.
2. Platform iOS. Name `Apex Lifts`. Primary language English (U.S.).
   Bundle ID: pick `com.gymtitles.app`. SKU: `apexlifts`. Full access. Create.

## What I do with those
- Generate Apple Development and Apple Distribution certificates through Apple's API
  (no Mac, no CSR clicking for you).
- Put the five secrets into the GitHub repository settings, never into the code.
- Push the repo and run the first build. Then invite your Apple ID as a TestFlight tester.

## After that
- Any change I make: I push, GitHub builds, TestFlight updates on your phone in about 20 minutes.
- You install TestFlight from the App Store on your iPhone once. Builds expire after 90 days,
  which only matters if I stop shipping updates.
- App Store review submission later happens in the App Store Connect website, no Mac.
