import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { WebView } from 'react-native-webview';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface WebViewMessage {
  type: 'notification' | 'file-picker' | 'camera' | 'gallery';
  data?: any;
}

export default function ProductionWebView() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        console.log('Notification permissions not granted');
      }

      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        console.log('Camera permissions not granted');
      }

      const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryStatus !== 'granted') {
        console.log('Gallery permissions not granted');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const showNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const message = JSON.stringify({
          type: 'file-selected',
          data: {
            name: file.name,
            uri: file.uri,
            size: file.size,
            mimeType: file.mimeType,
          },
        });
        webViewRef.current?.postMessage(message);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        const message = JSON.stringify({
          type: 'image-captured',
          data: {
            uri: image.uri,
            width: image.width,
            height: image.height,
          },
        });
        webViewRef.current?.postMessage(message);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        const message = JSON.stringify({
          type: 'image-selected',
          data: {
            uri: image.uri,
            width: image.width,
            height: image.height,
          },
        });
        webViewRef.current?.postMessage(message);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const onMessage = useCallback((event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'notification':
          showNotification(
            message.data?.title || 'Notification',
            message.data?.body || 'Notification from webview'
          );
          break;
        case 'file-picker':
          handleFilePicker();
          break;
        case 'camera':
          handleCamera();
          break;
        case 'gallery':
          handleGallery();
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }, []);

  const injectedJavaScript = `
    (function() {
      let originalConsole = window.console;
      window.console = {
        ...originalConsole,
        log: function(...args) {
          originalConsole.log.apply(originalConsole, args);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'console-log',
            data: args
          }));
        }
      };

      window.NativeBridge = {
        showNotification: function(title, body) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'notification',
            data: { title, body }
          }));
        },
        pickFile: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'file-picker'
          }));
        },
        takePhoto: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'camera'
          }));
        },
        pickImage: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'gallery'
          }));
        }
      };

      window.addEventListener('message', function(event) {
        console.log('Received message from native:', event.data);
      });

      true;
    })();
  `;

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(`WebView Error: ${nativeEvent.description}`);
    setIsLoading(false);
  };

  const onLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const onLoadStart = () => {
    setIsLoading(true);
    setError(null);
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error loading website</Text>
        <Text style={styles.errorSubText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E6F4FE" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://rewritelifestyle.ai' }}
        style={styles.webview}
        onMessage={onMessage}
        onError={handleError}
        onLoad={onLoad}
        onLoadStart={onLoadStart}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        allowsBackForwardNavigationGestures={true}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
