import { View, Text } from "react-native";

export default function NoteGrid({ notes }: { notes: { title: string, id: string }[] }) {
    return <View>
        <Text>NoteGrid</Text>
    </View>
}