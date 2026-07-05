package com.bowency.site.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Messages du formulaire de contact.
 * Persistés en fichiers texte (un par message) pour rester sans base de données,
 * comme le thème actif ; consultables sur /admin.
 */
@Service
public class ContactService {

    public record ContactMessage(String receivedAt, String name, String email, String message) {}

    private static final DateTimeFormatter FILE_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");
    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final Path storageDir;

    public ContactService(@Value("${bowency.contact.storage:data/contact-messages}") String storageDir) {
        this.storageDir = Path.of(storageDir);
    }

    public synchronized void save(String name, String email, String message) {
        try {
            Files.createDirectories(storageDir);
            LocalDateTime now = LocalDateTime.now();
            Path file = storageDir.resolve("msg-" + now.format(FILE_STAMP) + ".txt");
            String content = "date: " + now.format(DISPLAY) + "\n"
                    + "name: " + singleLine(name) + "\n"
                    + "email: " + singleLine(email) + "\n"
                    + "\n"
                    + message.strip() + "\n";
            Files.writeString(file, content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible d'enregistrer le message de contact", e);
        }
    }

    /** Messages reçus, du plus récent au plus ancien. */
    public List<ContactMessage> findAll() {
        if (!Files.isDirectory(storageDir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(storageDir)) {
            List<ContactMessage> messages = new ArrayList<>();
            files.filter(p -> p.getFileName().toString().startsWith("msg-"))
                 .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                 .forEach(p -> {
                     ContactMessage m = read(p);
                     if (m != null) {
                         messages.add(m);
                     }
                 });
            return messages;
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de lire les messages de contact", e);
        }
    }

    private ContactMessage read(Path file) {
        try {
            String raw = Files.readString(file, StandardCharsets.UTF_8);
            String[] parts = raw.split("\n\n", 2);
            String date = "", name = "", email = "";
            for (String line : parts[0].split("\n")) {
                if (line.startsWith("date: ")) date = line.substring(6);
                else if (line.startsWith("name: ")) name = line.substring(6);
                else if (line.startsWith("email: ")) email = line.substring(7);
            }
            String body = parts.length > 1 ? parts[1].strip() : "";
            return new ContactMessage(date, name, email, body);
        } catch (IOException e) {
            return null; // fichier illisible : on l'ignore plutôt que de casser l'admin
        }
    }

    private static String singleLine(String value) {
        return value.replaceAll("[\\r\\n]+", " ").strip();
    }
}
