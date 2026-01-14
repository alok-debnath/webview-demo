# Production WebView App

A production-ready Expo React Native app with a WebView component for https://rewritelifestyle.ai, featuring notification support, file picker, and camera access.

## Features

- **WebView**: Production-ready WebView with React Native WebView
- **Notifications**: Push notification support via expo-notifications
- **File Picker**: Document selection via expo-document-picker
- **Camera Access**: Photo capture and gallery access via expo-image-picker
- **Permissions**: Proper iOS and Android permissions configured
- **Error Handling**: Comprehensive error handling and loading states
- **Native Bridge**: JavaScript bridge for WebView-native communication

## Native Bridge API

The WebView injects a `NativeBridge` object that the website can use:

```javascript
// Show notification
NativeBridge.showNotification('Title', 'Body');

// Pick a file
NativeBridge.pickFile();

// Take a photo
NativeBridge.takePhoto();

// Pick from gallery
NativeBridge.pickImage();
```

## Message Handling

The app listens for messages from the WebView and responds accordingly:

- `notification`: Shows a native notification
- `file-picker`: Opens file picker
- `camera`: Opens camera
- `gallery`: Opens image gallery

## Installation & Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on device/simulator:
```bash
npm run android
npm run ios
```

## Permissions

### iOS
- Camera usage
- Photo library access
- Microphone access (for video recording)

### Android
- Camera
- External storage read/write
- Audio recording
- Post notifications

## Configuration

All permissions and plugins are configured in `app.json`. The WebView is configured with production-ready settings including:
- Custom user agent
- Media playback support
- Error handling
- Loading states
- Security settings

## Usage

The app automatically loads https://rewritelifestyle.ai in the WebView. The website can use the NativeBridge API to interact with native features.
