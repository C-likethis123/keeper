import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearVideoPosition,
  getVideoPosition,
  saveVideoPosition,
} from "../videoPositionStore";

// AsyncStorage is auto-mocked by jest-expo
beforeEach(() => {
  jest.clearAllMocks();
});

it("saves and retrieves a playback position for a url", async () => {
  await saveVideoPosition("https://www.youtube.com/watch?v=abc", 123.4);
  const pos = await getVideoPosition("https://www.youtube.com/watch?v=abc");
  expect(pos).toBeCloseTo(123.4);
});

it("returns 0 for a url with no stored position", async () => {
  const pos = await getVideoPosition("https://www.youtube.com/watch?v=new");
  expect(pos).toBe(0);
});

it("overwrites a previously saved position", async () => {
  await saveVideoPosition("https://example.com/v", 10);
  await saveVideoPosition("https://example.com/v", 99.9);
  const pos = await getVideoPosition("https://example.com/v");
  expect(pos).toBeCloseTo(99.9);
});

it("clears the stored position for a url", async () => {
  await saveVideoPosition("https://example.com/v", 55);
  await clearVideoPosition("https://example.com/v");
  const pos = await getVideoPosition("https://example.com/v");
  expect(pos).toBe(0);
});
