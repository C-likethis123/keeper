import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Note } from "@/services/notes/types";
import { useRouter } from "expo-router";
import { NoteService } from "@/services/notes/noteService";

export default function NoteCard({
    note,
}: {
    note: Note;
}) {
    const router = useRouter();

    const openNote = () => router.push(`/editor?filePath=${note.filePath}`);

    const onPinToggle = () => {
        note.isPinned = !note.isPinned;
        NoteService.instance.saveNote(note);
    };

    const onDelete = () => {
        NoteService.instance.deleteNote(note.filePath);
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={openNote}
            activeOpacity={0.8}
        >
            <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>
                    {note.title}
                </Text>

                {note.isPinned && (
                    <MaterialIcons
                        name="push-pin"
                        size={18}
                        color="#2563eb"
                    />
                )}
            </View>

            <Text style={styles.content} numberOfLines={3}>
                {note.content}
            </Text>

            <View style={styles.footer}>
                <Text style={styles.date}>
                    {new Date(note.lastUpdated).toLocaleDateString()}
                </Text>

                <View style={styles.actions}>
                    {!note.isPinned && (
                        <TouchableOpacity onPress={onPinToggle}>
                            <MaterialIcons name="push-pin" size={18} color="#6b7280" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onDelete}>
                        <MaterialIcons name="delete-outline" size={18} color="#6b7280" />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 12,
        backgroundColor: "#fff",
    },
    titleRow: {
        flexDirection: "row",
        gap: 6,
        alignItems: "flex-start",
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
    },
    content: {
        marginTop: 6,
        color: "#6b7280",
        flexGrow: 1,
    },
    footer: {
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    date: {
        flex: 1,
        fontSize: 12,
        color: "#9ca3af",
    },
    actions: {
        flexDirection: "row",
        gap: 12,
    },
});
