import { View, FlatList, useWindowDimensions } from "react-native";
import EmptyState from "./EmptyState";
import NoteCard from "@/components/NoteCard";
import { Note } from "@/services/notes/types";

export default function NoteGrid({ notes }: { notes: Note[] }) {
  const { width } = useWindowDimensions();

  if (!notes.length) {
    return (
      <EmptyState
        title="No notes found"
        subtitle="Create a note to get started"
      />
    );
  }

  // Responsive column count (matches Flutter logic)
  let numColumns = 2;
  if (width > 900) numColumns = 4;
  else if (width > 600) numColumns = 3;

  const pinned = notes.filter(n => n.isPinned);
  const unpinned = notes.filter(n => !n.isPinned);
  const sortedNotes = [...pinned, ...unpinned];

  return (
    <FlatList
      style={{ width: '100%' }}
      data={sortedNotes}
      key={numColumns}
      numColumns={numColumns}
      keyExtractor={(item) => item.filePath}
      columnWrapperStyle={numColumns > 1 ? { gap: 8, marginBottom: 8 } : undefined}
      contentContainerStyle={{ padding: 8 }}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / numColumns }}>
          <NoteCard note={item} />
        </View>
      )}
    />
  );
}
