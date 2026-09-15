package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
)

const contextClaimsKey = "claims"

func (s *Server) requireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}

		token, found := strings.CutPrefix(header, "Bearer ")
		if !found || strings.TrimSpace(token) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "expected a bearer token"})
			return
		}

		claims, err := s.cfg.JWT.Decode(strings.TrimSpace(token))
		if err != nil {
			c.Error(err)

			if errors.Is(err, utils.ErrExpiredToken) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
				return
			}

			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set(contextClaimsKey, claims)
		c.Next()
	}
}

func claimsFrom(c *gin.Context) *utils.Claims {
	value, ok := c.Get(contextClaimsKey)
	if !ok {
		return nil
	}

	claims, ok := value.(*utils.Claims)
	if !ok {
		return nil
	}

	return claims
}
