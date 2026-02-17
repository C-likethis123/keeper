import { useToastStore } from "@/stores/toastStore";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text } from "react-native";

export const ToastOverlay = () => {
	const { message } = useToastStore();
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (message) {
			Animated.timing(opacity, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(opacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start();
		}
	}, [message]);

	if (!message) return null;

	return (
		<Animated.View style={[styles.toast, { opacity }]}>
			<Text style={styles.text}>{message}</Text>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	toast: {
		position: "absolute",
		bottom: Platform.OS === "web" ? 20 : 50,
		left: 20,
		right: 20,
		padding: 12,
		backgroundColor: "#333",
		borderRadius: 8,
		alignItems: "center",
		zIndex: 9999,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 4,
	},
	text: { color: "#fff", fontWeight: "500" },
});
