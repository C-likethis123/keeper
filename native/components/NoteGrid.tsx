import { View, FlatList, useWindowDimensions } from "react-native";
import EmptyState from "./EmptyState";
import NoteCard from "@/components/NoteCard";
import { NoteMetadata } from "@/services/notes/types";

export default function NoteGrid({ notes }: { notes: NoteMetadata[] }) {
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
      data={sortedNotes}
      key={numColumns}
      numColumns={numColumns}
      keyExtractor={(item) => item.filePath}
      columnWrapperStyle={{ gap: 8 }}
      contentContainerStyle={{ padding: 8 }}
      renderItem={({ item }) => (
        <NoteCard note={item} />
      )}
    />
  );
}
