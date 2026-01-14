import ProductionWebView from '@/components/ProductionWebView';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function HomeScreen() {
  return <ProductionWebView />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
