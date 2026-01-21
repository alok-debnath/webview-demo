import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, View } from "react-native";
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
  type:
    | "notification"
    | "file-picker"
    | "camera"
    | "gallery"
    | "location"
    | "console-log";
  data?: any;
}

export default function ProductionWebView() {
  const webViewRef = useRef<WebView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  /* -------------------- Back handling -------------------- */

  const handleBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    requestPermissions();

    const back = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    return () => back.remove();
  }, [handleBackPress]);

  const requestPermissions = async () => {
    await Notifications.requestPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  /* -------------------- Native actions -------------------- */

  const handleLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "location",
          data: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            timestamp: loc.timestamp,
          },
        }),
      );
    } catch {}
  };

  const handleFilePicker = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["*/*"],
      copyToCacheDirectory: true,
    });

    if (!res.canceled && res.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "file-selected", data: res.assets[0] }),
      );
    }
  };

  const handleCamera = async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!res.canceled && res.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "image-captured", data: res.assets[0] }),
      );
    }
  };

  const handleGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!res.canceled && res.assets?.length) {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "image-selected", data: res.assets[0] }),
      );
    }
  };

  const showNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null,
    });
  };

  /* -------------------- Web → Native router -------------------- */

  const handleMessage = useCallback((event: any) => {
    try {
      const msg: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case "console-log":
          // console.log("[WEB]", ...msg.data);
          return;

        case "notification":
          showNotification(
            msg.data?.title ?? "Notification",
            msg.data?.body ?? "",
          );
          break;

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
      }
    } catch {
      console.warn("Invalid WebView message");
    }
  }, []);

  /* -------------------- Injected JS (BEFORE LOAD) -------------------- */

  const injectedBeforeLoad = `
    (function () {
      function InterceptedNotification(title, options = {}) {
        window.ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: "notification",
            data: {
              title,
              body: options.body ?? "",
            },
          })
        );

        return {
          title,
          body: options.body,
          close: function () {},
        };
      }

      // Define Notification EVEN IF IT DOES NOT EXIST
      InterceptedNotification.permission = "granted";
      InterceptedNotification.requestPermission = function () {
        return Promise.resolve("granted");
      };

      window.Notification = InterceptedNotification;
    })();
  `;

  /* -------------------- Injected JS (AFTER LOAD) -------------------- */

  const devInjectedJS = `
    (function () {
      const orig = console.log;
      console.log = function (...args) {
        orig.apply(console, args);
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "console-log", data: args })
        );
      };
    })();
  `;

  const baseInjectedJS = `
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
    })();
  `;

  const injectedJavaScript = __DEV__
    ? devInjectedJS + baseInjectedJS
    : baseInjectedJS;

  /* -------------------- Render -------------------- */

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
        // source={{
        //   uri: "https://5789fa0c-a3cb-4f74-9425-9c9fa0d3b3ac-00-1z09g5cd7izl0.spock.replit.dev:5000",
        // }}
        // source={require("../index.html")}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
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
  container: { flex: 1, backgroundColor: "#fff" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    zIndex: 1,
  },
});
