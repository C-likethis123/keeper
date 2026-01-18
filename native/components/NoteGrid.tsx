import { View, Text } from "react-native";
import EmptyState from "./EmptyState";

export default function NoteGrid({ notes }: { notes: { title: string, id: string }[] }) {
    if (!notes.length) {
        return (
          <EmptyState
            title={'No notes found'}
            subtitle={'Create a note to get started'}
          />
        );
      }
    return <View>
        <Text>NoteGrid</Text>
    </View>
}