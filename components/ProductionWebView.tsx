import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface WebViewMessage {
  type: "notification" | "file-picker" | "camera" | "gallery" | "location";
  data?: any;
}

export default function ProductionWebView() {
  const webViewRef = useRef<WebView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const handleBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    requestPermissions();

    const subscription = Notifications.addNotificationReceivedListener(
      () => {},
    );
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    return () => {
      subscription.remove();
      backHandler.remove();
    };
  }, [handleBackPress]);

  const requestPermissions = async () => {
    await Notifications.requestPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  /* -------------------- Native Actions -------------------- */

  const handleLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: "location-error",
            data: { message: "Permission denied" },
          }),
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "location",
          data: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          },
        }),
      );
    } catch {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "location-error",
          data: { message: "Failed to fetch location" },
        }),
      );
    }
  };

  const handleFilePicker = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["*/*"],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "file-selected",
          data: result.assets[0],
        }),
      );
    }
  };

  const handleCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "image-captured",
          data: result.assets[0],
        }),
      );
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "image-selected",
          data: result.assets[0],
        }),
      );
    }
  };

  const showNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null,
    });
  };

  /* -------------------- Web → Native Router -------------------- */

  const handleMessage = useCallback((event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case "location":
          handleLocation();
          break;
        case "camera":
          handleCamera();
          break;
        case "gallery":
          handleGallery();
          break;
        case "file-picker":
          handleFilePicker();
          break;
        case "notification":
          showNotification(
            message.data?.title ?? "Notification",
            message.data?.body ?? "",
          );
          break;
      }
    } catch {
      console.warn("Invalid WebView message");
    }
  }, []);

  /* -------------------- Injected JS -------------------- */

  const injectedJavaScript = `
    (function () {
      window.NativeBridge = {
        getLocation: () =>
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: "location" })
          ),
        takePhoto: () =>
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: "camera" })
          ),
        pickImage: () =>
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: "gallery" })
          ),
        pickFile: () =>
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: "file-picker" })
          ),
        showNotification: (title, body) =>
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: "notification", data: { title, body } })
          ),
      };

      true;
    })();
  `;

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: "https://rewritelifestyle.ai" }}
        // source={{ uri: "https://5789fa0c-a3cb-4f74-9425-9c9fa0d3b3ac-00-1z09g5cd7izl0.spock.replit.dev:5000" }}
        // source={require("../index.html")}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        onLoad={() => setIsLoading(false)}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
