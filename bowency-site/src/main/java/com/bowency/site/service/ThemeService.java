package com.bowency.site.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Thème actif du site, choisi par les administrateurs.
 * Persisté dans un fichier texte pour survivre aux redémarrages sans base de données.
 */
@Service
public class ThemeService {

    public static final String NOCTURNE = "nocturne";
    public static final String GRANDSOIR = "grandsoir";
    public static final String OCRE = "ocre";
    public static final String EMERAUDE = "emeraude";
    public static final String AMETHYSTE = "amethyste";
    private static final Set<String> THEMES = Set.of(NOCTURNE, GRANDSOIR, OCRE, EMERAUDE, AMETHYSTE);

    private final Path storage;
    private volatile String activeTheme;

    public ThemeService(@Value("${bowency.theme.storage:data/active-theme}") String storagePath,
                        @Value("${bowency.theme.default:nocturne}") String defaultTheme) {
        this.storage = Path.of(storagePath);
        this.activeTheme = load(defaultTheme);
    }

    public String getActiveTheme() {
        return activeTheme;
    }

    public boolean isValid(String theme) {
        return theme != null && THEMES.contains(theme);
    }

    public synchronized void setActiveTheme(String theme) {
        if (!isValid(theme)) {
            throw new IllegalArgumentException("Theme inconnu: " + theme);
        }
        this.activeTheme = theme;
        try {
            if (storage.getParent() != null) {
                Files.createDirectories(storage.getParent());
            }
            Files.writeString(storage, theme, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'enregistrer le theme", e);
        }
    }

    private String load(String fallback) {
        try {
            if (Files.exists(storage)) {
                String saved = Files.readString(storage, StandardCharsets.UTF_8).trim();
                if (THEMES.contains(saved)) {
                    return saved;
                }
            }
        } catch (IOException ignored) {
            // fichier illisible : on repart sur le défaut
        }
        return THEMES.contains(fallback) ? fallback : NOCTURNE;
    }
}
